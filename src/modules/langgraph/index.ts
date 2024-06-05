import { ToolExecutor } from "@langchain/langgraph/prebuilt";
import { ChatOpenAI } from "@langchain/openai";
import { z } from "zod";
import { createOpenAIFunctionsAgent } from "langchain/agents";
import { pull } from "langchain/hub";

import { incrementTool } from "./workflows/increment";
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  MessagesPlaceholder,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "@langchain/core/prompts";
import { BaseMessage } from "@langchain/core/messages";
import { AgentAction, AgentFinish, AgentStep } from "@langchain/core/agents";
import type { RunnableConfig } from "@langchain/core/runnables";
import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { END, START, StateGraph, StateGraphArgs } from "@langchain/langgraph";
import { decrementTool } from "./workflows/decrement";
import { talkSearchTool } from "./workflows/talks";
import { DynamicStructuredTool, DynamicTool, Tool } from "langchain/tools";
import { cypherTool } from "./workflows/database";
import { initGraph } from "../graph";
import { getHistory } from "../agent/history";
import {
  StringOutputParser,
  StructuredOutputParser,
} from "@langchain/core/output_parsers";

export async function buildGraph() {
  const model = new ChatOpenAI({
    temperature: 0,
  });

  const guardrailTool = new DynamicStructuredTool({
    name: "guardrail",
    description:
      "you must use this tool whenever the user asks something that doesn't relate to the conference.",
    schema: z.object({ input: z.string() }),
    func: async (input) => {
      return `
        Guardrails are in place to stop me answering questions that dont relate to the conference.
        Respond informing the user that you will not answer the question and end with a joke about developers.
      `;
    },
  });

  const weatherTool = new DynamicTool({
    name: "weather",
    description: "useful when the user needs to know about the weather",
    func: async () => `It's going to be hot 🔥🔥🔥`,
  });

  const tools = [
    incrementTool(),
    decrementTool(),
    talkSearchTool(),
    cypherTool(),
    weatherTool,

    // guardrailTool,
  ];
  // // Get the prompt to use - you can modify this!
  // const prompt = await pull<ChatPromptTemplate>(
  //   "hwchase17/openai-functions-agent"
  // );

  const prompt = ChatPromptTemplate.fromMessages([
    SystemMessagePromptTemplate.fromTemplate(`
      You are a helpful assistant.
    `),
    HumanMessagePromptTemplate.fromTemplate(`{input}`),
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  // Choose the LLM that will drive the agent
  const llm = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0,
  });

  // Construct the OpenAI Functions agent
  const agentRunnable = await createOpenAIFunctionsAgent({
    llm,
    tools,
    prompt,
  });

  const agentState: StateGraphArgs<AgentState>["channels"] = {
    input: {
      value: (x: string, y: string) => y || x,
      default: () => "",
    },
    rephrased: {
      value: (x: string, y: string) => y || x,
      default: () => "",
    },
    history: {
      value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
      default: () => [],
    },
    steps: {
      value: (x: any, y: any) => x.concat(y),
      default: () => [],
    },
    agentOutcome: {
      value: (x, y) => y,
      default: () => undefined,
    },
    output: null,
  };

  interface AgentStateBase {
    history: BaseMessage[];
    rephrased: string;
    agentOutcome?: AgentAction | AgentFinish;
    steps: Array<AgentStep>;
    output: string;
  }

  interface AgentState extends AgentStateBase {
    input: string;
    chatHistory?: BaseMessage[];
  }

  // Create a Tool Executor
  const toolExecutor = new ToolExecutor({
    tools,
  });

  // Define logic that will be used to determine which conditional edge to go down
  const shouldContinue = (data: AgentState) => {
    if (data.agentOutcome && "returnValues" in data.agentOutcome) {
      return "end";
    }
    return "continue";
  };

  const runAgent = async (data: AgentState, config?: RunnableConfig) => {
    console.log("runAgent", { data });

    // Decide which tool to run
    const agentOutcome = await agentRunnable.invoke(data, config);

    return {
      agentOutcome,
    };
  };

  const executeTools = async (data: AgentState, config?: RunnableConfig) => {
    const agentAction = data.agentOutcome;
    if (!agentAction || "returnValues" in agentAction) {
      throw new Error("Agent has not been run yet");
    }
    // Execute the tool
    const output = await toolExecutor.invoke(agentAction, config);
    return {
      steps: [{ action: agentAction, observation: JSON.stringify(output) }],
    };
  };

  const rephraseQuestion = async (
    data: AgentState,
    config?: RunnableConfig
  ) => {
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

  const shouldRefuse = async (data: AgentState) => {
    const parser = StructuredOutputParser.fromZodSchema(z.enum(["yes", "no"]));

    const prompt = PromptTemplate.fromTemplate(`
    You are a helpful agent answering questions about the CityJS Athens
    conference.  Your task is to decide whether you should answer the user's
    question.

    Does the following question fall into one of the following categories?

    * Talks that could be taking place at the conference
    * Speakers that could be giving a talk at the conference
    * The weather at the conference


    Question: {rephrased}

    {format_instructions}
    `);

    const chain = RunnableSequence.from([prompt, llm, parser]);

    const res = await chain.invoke({
      rephrased: data.rephrased,
      format_instructions: parser.getFormatInstructions(),
    });

    console.log("shouldRefuse", {
      res,
      op: res === "yes" ? "continue" : "refuse",
      format_instructions: parser.getFormatInstructions(),
    });

    return res === "yes" ? "agent" : "refuse";
  };

  const refuse = async (input_: AgentState) => ({
    agentOutcome: {
      returnValues: {
        output: `
        Guardrails are in place to stop me answering questions that don't relate to the conference.
        You could try asking me about the weather?
      `,
      },
      log: "",
    },
  });

  // Define a new graph
  const workflow = new StateGraph({
    // @ts-ignore
    channels: agentState,
  })
    .addNode("rephrase", rephraseQuestion)
    .addNode("refuse", refuse)

    .addConditionalEdges("rephrase", shouldRefuse)
    .addEdge("refuse", END)

    .addNode("agent", new RunnableLambda({ func: runAgent }))
    .addNode("action", new RunnableLambda({ func: executeTools }))
    // .addNode("agent", runAgent)
    // .addNode("action", executeTools)
    .addEdge(START, "rephrase")
    .addConditionalEdges(
      // First, we define the start node. We use `agent`.
      // This means these are the edges taken after the `agent` node is called.
      "agent",
      // Next, we pass in the function that will determine which node is called next.
      shouldContinue,
      // Finally we pass in a mapping.
      // The keys are strings, and the values are other nodes.
      // END is a special node marking that the graph should finish.
      // What will happen is we will call `should_continue`, and then the output of that
      // will be matched against the keys in this mapping.
      // Based on which one it matches, that node will then be called.
      {
        // If `tools`, then we call the tool node.
        continue: "action",
        // Otherwise we finish.
        end: END,
      }
    )
    .addEdge("action", "agent");

  await workflow.validate();

  return workflow.compile();
}

// TODO: This needs to be exportable
type CompiledStateGraph = any;

let agent: CompiledStateGraph;

export async function call(input: string): Promise<string> {
  if (agent === undefined) {
    agent = await buildGraph();
  }

  const res = await agent.invoke({ input });
  return res.agentOutcome.returnValues.output;
}
