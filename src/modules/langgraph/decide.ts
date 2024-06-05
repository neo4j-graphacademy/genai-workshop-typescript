import { BaseMessage } from "@langchain/core/messages";
import { END, START, StateGraph, StateGraphArgs } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { AgentState } from "./constants";
import { rephraseQuestion } from "./nodes/rephrase";
import { router } from "./nodes/router";
import {
  NODE_DATABASE_QUERY,
  NODE_JOKE,
  NODE_REPHRASE,
  NODE_TALK_RETRIEVER,
} from "./constants";
import { initRetrievalChain } from "./workflows/talks";
import { initCypherQAChain } from "./workflows/database";
import { tellJoke } from "./nodes/joke";

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

/**
- router
- conditional:
 */

export async function buildLangGraphAgent() {
  const talkChain = await initRetrievalChain();
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
    .addEdge(NODE_JOKE, END);

  const app = await graph.compile();

  return app;
}

export async function call(input: string, sessionId?: string) {
  const agent = await buildLangGraphAgent();

  const res = await agent.invoke({ input }, { configurable: { sessionId } });

  return res.output;
}
