import { ChatOpenAI } from "@langchain/openai";
import { OpenAIEmbeddings } from "@langchain/openai";
import initAgent from "./agent";
import { initGraph } from "../graph";
import { sleep } from "@/utils";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
} from "@langchain/core/prompts";
import {
  RunnablePassthrough,
  RunnableSequence,
} from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { clearHistory, getHistory, saveHistory } from "./history";
import { Neo4jVectorStore } from "@langchain/community/vectorstores/neo4j_vector";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { formatDocumentsAsString } from "langchain/util/document";
import { BaseMessage } from "langchain/schema";
import { Document } from "langchain/document";
import { DocumentInterface } from "@langchain/core/documents";

// tag::call[]
export async function call(input: string, sessionId: string): Promise<string> {
  // TODO: Replace this code with an agent
  // await sleep(2000);

  if (input === "/clear" || input === "/c") {
    await clearHistory(sessionId);

    return "👍";
  }

  const llm = new ChatOllama({ model: "llama3" });
  // const llm = new ChatOpenAI({
  //   openAIApiKey: process.env.OPENAI_API_KEY,
  // });

  const prompt = ChatPromptTemplate.fromMessages([
    // ["ai", "You are a helpful assistant"],
    [
      "ai",
      "[INST]You are a helpful assistant providing a user with recommendations for meetups to attend.[/INST]",
    ],
    // new MessagesPlaceholder("history"),
    [
      "ai",
      `
  Here is a JSON list of events to help you answer the question.

  \`\`\`
  {context}
  \`\`\`

  Use only this information to answer the question.
  Do not mention the structure of the data.
  Always provide a link to the event in your response.
  Do not reference the JSON list of events.

  `,
    ],
    HumanMessagePromptTemplate.fromTemplate("Question: {input}"),
  ]);

  const history = await getHistory(sessionId);

  const embeddings = new OllamaEmbeddings({
    model: "nomic-embed-text",
  });
  const eventStore = await Neo4jVectorStore.fromExistingGraph(embeddings, {
    url: process.env.NEO4J_URI,
    username: process.env.NEO4J_USERNAME,
    password: process.env.NEO4J_PASSWORD,
    nodeLabel: "Event",
    textNodeProperties: ["name", "description"],
    indexName: "event_description",
    embeddingNodeProperty: "embedding",
    retrievalQuery: `
      MATCH (node)<-[:HOSTED_EVENT]-(host)
      RETURN node.description AS text,
        score AS score,
        node {
          _id: elementId(node),
          .id,
          .name,
          url: 'https://feetup.com/'+ host.urlname + '/events/'+ node.id,
          time: toString(node.time),
          host: host {
            .name,
            .id,
            url: 'https://feetup.com/'+ host.urlname + '/'
          }
        } AS metadata
    `,
  });
  const eventRetriever = eventStore.asRetriever(3);

  const chain = RunnableSequence.from<
    { input: string; history: BaseMessage[] },
    string
  >([
    {
      input: (args) => args.input,
      history: (args) =>
        args.history.map((message) => message.toJSON()).join("\n"),
      context: RunnableSequence.from([
        (args) => args.input,
        eventRetriever.pipe((docs) => JSON.stringify(docs)),
      ]),
    },
    prompt,
    llm,
    new StringOutputParser(),
  ]);

  const response = await chain.invoke({
    input,
    history,
  });

  await saveHistory(sessionId, "convo", input, "", response, [], null);

  return response;
}
// end::call[]
