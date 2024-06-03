import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { Embeddings } from "@langchain/core/embeddings";
import { BaseChatModel } from "langchain/chat_models/base";

import { START, END, StateGraph } from "@langchain/langgraph";
import {
  AIMessage,
  BaseMessage,
  BaseMessageChunk,
  HumanMessage,
} from "langchain/schema";

import { StateGraphArgs } from "@langchain/langgraph";
import { Document, type DocumentInterface } from "@langchain/core/documents";
import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate, PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableLike } from "@langchain/core/runnables";

export interface BaseGraphState {
  history: BaseMessage[];
  message: string;
  rephrased: string;
}

/**
 * Represents the state of our graph.
 */
type GraphState = BaseGraphState & {
  documents: Document[];
  generation?: string;
};

const graphState: StateGraphArgs<GraphState>["channels"] = {
  history: {
    value: (left: BaseMessage[], right: BaseMessage[]) =>
      right ? left.concat(right) : left,
    default: () => [],
  },
  message: {
    value: (left?: string, right?: string) => (right ? right : left || ""),
    default: () => "",
  },
  rephrased: {
    value: (left?: string, right?: string) => (right ? right : left || ""),
    default: () => "",
  },
  documents: {
    value: (left?: Document[], right?: Document[]) =>
      right ? right : left || [],
    default: () => [],
  },
  generation: {
    value: (left?: string, right?: string) => (right ? right : left),
    default: () => undefined,
  },
};

const llm = new ChatOpenAI();

const getHistory: RunnableLike<GraphState, Partial<GraphState>> = async (
  input: GraphState
) => {
  return {
    history: [
      new HumanMessage("Can you recommend a movie?"),
      new AIMessage("Sure, I recommend 'Neo4j The Movie'."),
    ],
  } as Partial<GraphState>;
};

const rephraseQuestion = async (input: GraphState) => {
  const prompt = ChatPromptTemplate.fromTemplate(
    `You are using conversation history to generate a question that is well optimized
        for semantic search retrieval.

        Look at the input and try to reason about the underlying sematic intent / meaning.

      Here is the conversation history:
      \n ------- \n
      {history}
      \n ------- \n

      Here is the latest message:
      \n ------- \n
      {message}
      \n ------- \n
      Formulate an improved question: `
  );

  // Grader
  const model = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0,
    streaming: true,
  });

  // Prompt
  const chain = prompt.pipe(model).pipe(new StringOutputParser());
  const rephrased = await chain.invoke({
    message: input.message,
    history: input.history
      .map((msg) => JSON.stringify(msg.toJSON()))
      .join("\n"),
  });

  return {
    rephrased: rephrased,
  };
};

const getDocuments = async (input: GraphState) => {
  return {
    documents: [],
    // [
    //   new Document({
    //     pageContent: "Foo Bar is an american actor",
    //     metadata: {
    //       source: "https://tmdb.com/foo",
    //       movie: "Neo4j The Movie",
    //       born: 1987,
    //     },
    //   }),
    //   new Document({
    //     pageContent: "Baz Lexigton is a latin-american actor",
    //     metadata: {
    //       source: "https://tmdb.com/baz",
    //       movie: "Neo4j The Movie",
    //       famousFor: "The Matrix",
    //     },
    //   }),
    // ],
  };
};

const generate = async (input: GraphState) => {
  const prompt = PromptTemplate.fromTemplate(`
        Use the documents provided to respond to the message below.
        The documents hae been provided by semantic search so they may not provide a complete
        answer to the question.  If the documents do not answer the question, simply say you don't know
        and ask for clarification.

        Documents:
        ----
        {documents}
        ----

        Intent:
        ----
        {rephrased}
        ----

        Answer as if you are following on the conversation from this message:
        ----
        {message}
        ----

        Do not mention the documents.

    `);

  const model = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0,
    streaming: true,
  });

  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  const generation = await chain.invoke({
    documents: JSON.stringify(input.documents),
    rephrased: input.rephrased,
    message: input.message,
  });

  return {
    generation,
  };
};

export function buildSomeGraph() {
  const builder = new StateGraph({
    channels: graphState,
  })
    .addNode("getHistory", getHistory)
    .addNode("rephraseQuestion", rephraseQuestion)
    .addNode("getDocuments", getDocuments)
    .addNode("generate", generate)
    .addEdge(START, "getHistory")
    .addEdge("getHistory", "rephraseQuestion");
  builder.addEdge("rephraseQuestion", "getDocuments");
  builder.addEdge("getDocuments", "generate");
  builder.addEdge("generate", END);

  const app = builder.compile();

  return app;
}
/*
function x() {
  const builder = new StateGraph({
    channels: graphState,
  });
  builder.addNode("getHistory", getHistory);
  builder.addNode("rephraseQuestion", rephraseQuestion);
  builder.addNode("getDocuments", getDocuments);
  builder.addNode("generate", generate);

  builder

    .addEdge("getHistory", "rephraseQuestion");
  builder.addEdge("rephraseQuestion", "getDocuments");
  builder.addEdge("getDocuments", "generate");
  builder.addEdge("generate", END);

  const app = builder.compile();

  return app;
}
*/
