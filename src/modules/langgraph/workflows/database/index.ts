import { Neo4jGraph } from "@langchain/community/graphs/neo4j_graph";
import { ChatOpenAI } from "@langchain/openai";
import { GraphCypherQAChain } from "@langchain/community/chains/graph_qa/cypher";
import { DynamicStructuredTool } from "langchain/tools";

export async function initCypherQAChain() {
  const llm = new ChatOpenAI({ model: "gpt-4-turbo" });
  const graph = await initGraph();
  // Neo4jGraph.initialize({
  //   url: process.env.NEO4J_URI as string,
  //   username: process.env.NEO4J_USERNAME as string,
  //   password: process.env.NEO4J_PASSWORD as string,
  //   database: process.env.NEO4J_DATABASE as string | undefined,
  //   enhancedSchema: true,
  // });

  const chain = GraphCypherQAChain.fromLLM({
    graph,
    llm,
    returnDirect: true,
  });

  return chain;
}

import { z } from "zod";
import { initGraph } from "@/modules/graph";
export function cypherTool() {
  return new DynamicStructuredTool({
    name: "database",
    description:
      "useful for answering quantitative questions that cannot be answered with semantic search",
    schema: z.object({
      input: z.string(),
    }),
    func: async (input) => {
      console.log({ input });

      const chain = await initCypherQAChain();
      const res = await chain.invoke({ query: input.input });

      return res as unknown as string;
    },
  });
}
