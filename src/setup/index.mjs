import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import { config } from "dotenv";

async function main() {
  config({ path: "./.env.local" });

  console.log(`🗃️ Connecting to ${process.env.NEO4J_URI}`);

  const embeddings = new OllamaEmbeddings({
    model: "nomic-embed-text",
  });

  await createEventVectorIndex(embeddings);
  await createGroupVectorIndex(embeddings);
}

async function createGroupVectorIndex(embeddings) {
  try {
    await Neo4jVectorStore.fromExistingGraph(embeddings, {
      url: process.env.NEO4J_URI,
      username: process.env.NEO4J_USERNAME,
      password: process.env.NEO4J_PASSWORD,
      nodeLabel: "Group",
      textNodeProperties: ["name", "description"],
      indexName: "group_embeddings",
      embeddingNodeProperty: "embedding",
    });
  } catch (e) {
    console.error(e);
  }
}

async function createEventVectorIndex(embeddings) {
  try {
    await Neo4jVectorStore.fromExistingGraph(embeddings, {
      url: process.env.NEO4J_URI,
      username: process.env.NEO4J_USERNAME,
      password: process.env.NEO4J_PASSWORD,
      nodeLabel: "Event",
      textNodeProperties: ["name", "description"],
      indexName: "event_description",
      embeddingNodeProperty: "embedding",
    });
  } catch (e) {
    console.error(e);
  }
}

main();
