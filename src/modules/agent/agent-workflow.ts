import { BaseMessage } from "@langchain/core/messages";
import { END, START, StateGraph, StateGraphArgs } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";

import { rephraseQuestion } from "./nodes/rephrase";
import { router } from "./nodes/router";
import {
  AgentState,
  NODE_SPEAKER_RETRIEVER,
  NODE_WEATHER_INFO,
  NODE_DATABASE_QUERY,
  NODE_JOKE,
  NODE_REPHRASE,
  NODE_TALK_RETRIEVER,
} from "./constants";
import { initTalksRetrievalChain } from "./nodes/talks";
import { initSpeakerRetrievalChain } from "./nodes/speakers";
import { initCypherQAChain } from "./nodes/database";
import { tellJoke } from "./nodes/joke";
import { weatherForecast } from "./nodes/weather";

const agentState: StateGraphArgs<AgentState>["channels"] = {
  input: null,
  rephrased: null,
  messages: null,
  output: null,
  log: {
    value: (x: string[], y: string[]) => x.concat(y),
    default: () => [],
  },
};

export async function buildAgentWorkflow() {
  const talkChain = await initTalksRetrievalChain();
  const speakerChain = await initSpeakerRetrievalChain();
  const databaseChain = await initCypherQAChain();

  const model = new ChatOpenAI({
    temperature: 0,
  });

  const graph = new StateGraph({
    channels: agentState,
  })

    // 1. Get conversation history and rephrase the question
    .addNode(NODE_REPHRASE, rephraseQuestion)
    .addEdge(START, NODE_REPHRASE)

    // 2. route the request
    .addConditionalEdges(NODE_REPHRASE, router)

    // 3. Call Vector tool
    .addNode(NODE_TALK_RETRIEVER, async (data: AgentState) => {
      const output = await talkChain.invoke({ message: data.input });
      return { output };
    })
    .addEdge(NODE_TALK_RETRIEVER, END)

    // 4. Call CypherQAChain
    .addNode(NODE_DATABASE_QUERY, async (data: AgentState) => {
      // TODO: type error in export
      const output = (await databaseChain.invoke({
        query: data.input,
      })) as unknown as string;

      return { output };
    })
    .addEdge(NODE_DATABASE_QUERY, END)

    // 5. Tell a joke
    .addNode(NODE_JOKE, tellJoke)
    .addEdge(NODE_JOKE, END)

    // Speaker info
    .addNode(NODE_SPEAKER_RETRIEVER, async (data: AgentState) => {
      const output = await speakerChain.invoke({ message: data.input });
      return { output };
    })
    .addEdge(NODE_SPEAKER_RETRIEVER, END)

    // Weather
    .addNode(NODE_WEATHER_INFO, weatherForecast)
    .addEdge(NODE_WEATHER_INFO, END);

  const app = await graph.compile();

  return app;
}
