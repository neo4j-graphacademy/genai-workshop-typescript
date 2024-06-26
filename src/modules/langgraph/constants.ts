import { BaseMessage } from "@langchain/core/messages";

export type AgentState = {
  input: string;
  rephrased: string;
  messages: BaseMessage[];
  output: string;
  log: string[];
};

export const NODE_REPHRASE = "rephrase";
export const NODE_ROUTER = "router";
export const NODE_TALK_RETRIEVER = "talk";
export const NODE_DATABASE_QUERY = "database";
export const NODE_JOKE = "joke";
