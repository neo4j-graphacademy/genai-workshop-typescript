import { getHistory } from "../../../modules/agent/history";
import { StringOutputParser } from "@langchain/core/output_parsers";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { RunnableConfig, RunnableSequence } from "@langchain/core/runnables";
import { AgentState } from "../constants";
import { ChatOpenAI } from "@langchain/openai";

export const rephraseQuestion = async (
  data: AgentState,
  config?: RunnableConfig
) => {
  const llm = new ChatOpenAI({ temperature: 0 });
  const history = await getHistory(config?.configurable?.sessionId, 5);

  const rephrase = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`
        Use the following conversation history to rephrase the input
        into a standalone question.
      `),
    new MessagesPlaceholder("history"),
    HumanMessagePromptTemplate.fromTemplate(`Input: {input}`),
  ]);

  const rephraseChain = RunnableSequence.from([
    rephrase,
    llm,
    new StringOutputParser(),
  ]);

  const rephrased = await rephraseChain.invoke({
    history,
    input: data.input,
  });

  console.log({
    input: data.input,
    rephrased,
  });

  return {
    history,
    rephrased,
  };
};
