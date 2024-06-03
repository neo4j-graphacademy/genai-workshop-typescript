import { END, START, StateGraph, StateGraphArgs } from "@langchain/langgraph";
import { DynamicStructuredTool } from "langchain/tools";
import { z } from "zod";

type IncrementGraphState = {
  maximum: number;
  current: number;
  generated: string | undefined;
  log: string[];
};

const initialIncrementGraphState: StateGraphArgs<IncrementGraphState>["channels"] =
  {
    maximum: {
      value: (a: number, b: number) => b || a,
      default: () => 0,
    },
    current: {
      value: (a: number, b: number) => b || a,
      default: () => 0,
    },
    generated: {
      value: (a: string | undefined, b: string | undefined) => b || a,
      default: () => undefined,
    },
    log: {
      value: (a: string[], b: string[]) => a.concat(b),
      default: () => [],
    },
  };

function increment(state: IncrementGraphState) {
  return {
    log: [...state.log, "increment"],
    current: state.current + 1,
  };
}

function generateResponse(state: IncrementGraphState) {
  return {
    log: [...state.log, "generate"],
    generated: `The final number is ${state.current}`,
  };
}

function shouldContinue(state: IncrementGraphState) {
  console.log(`deciding whether to continue on: ${state.current}`);
  if (state.current >= state.maximum) {
    return GENERATE;
  }

  return INCREMENT;
}

const INCREMENT = "increment";
const GENERATE = "generate";
const SHOULD_CONTINUE = "shouldContinue";

export function buildIncrementWorkflow() {
  const workflow = new StateGraph<IncrementGraphState>({
    channels: initialIncrementGraphState,
  })
    .addNode(INCREMENT, increment)
    .addNode(GENERATE, generateResponse)

    .addEdge(START, INCREMENT)
    .addConditionalEdges(INCREMENT, shouldContinue)
    .addEdge(GENERATE, END);

  return workflow.compile();
}

export function incrementTool() {
  const app = buildIncrementWorkflow();

  return new DynamicStructuredTool({
    name: "increment",
    description: "increments a number to a maximum value",
    schema: z.object({
      maximum: z.number(),
    }),
    func: async (input) => {
      const chain = buildIncrementWorkflow();
      return chain.invoke(input);
    },
  });
}
