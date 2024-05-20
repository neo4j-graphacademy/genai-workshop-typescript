import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import initAgent from "./agent";
import { initGraph } from "../graph";
import { sleep } from "@/utils";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnablePassthrough, RunnableSequence } from "langchain/runnables";
import { clearHistory, getHistory, saveHistory } from "./history";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import { Document } from "langchain/document";
import { ChatOllama } from "langchain/chat_models/ollama";

// tag::call[]
export async function call(input: string, sessionId: string): Promise<string> {
  // TODO: Replace this code with an agent
  await sleep(2000);
  return input;
}
// end::call[]
