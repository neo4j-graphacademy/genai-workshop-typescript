import { END, START, StateGraph, StateGraphArgs } from "@langchain/langgraph";
import { DynamicStructuredTool } from "langchain/tools";
import { z } from "zod";

type DecrementGraphState = {
  start: number;
  minimum: number;
  current: number | undefined;
  output: string | undefined;
};

const initialIncrementGraphState: StateGraphArgs<DecrementGraphState>["channels"] =
  {
    start: {
      value: (a: number, b: number) => b || a,
      default: () => 0,
    },
    minimum: {
      value: (a: number, b: number) => b || a,
      default: () => 0,
    },
    current: {
      value: (a: number | undefined, b: number | undefined) => b || a,
      default: () => 0,
    },
    output: {
      value: (a: string | undefined, b: string | undefined) => b || a,
      default: () => undefined,
    },
  };

function decrement(state: DecrementGraphState) {
  if (!state.current) {
    return { current: state.start };
  }

  return {
    current: state.current - 1,
  };
}

function generateResponse(state: DecrementGraphState) {
  return {
    output: `The number went from ${state.start} to ${state.current}`,
  };
}

function shouldContinue(state: DecrementGraphState) {
  if (state.current === undefined || state.current <= state.minimum) {
    return GENERATE;
  }

  return DECREMENT;
}

const DECREMENT = "decrement";
const GENERATE = "generate";

export function buildDecrementWorkflow() {
  const workflow = new StateGraph<DecrementGraphState>({
    channels: initialIncrementGraphState,
  })
    .addNode(DECREMENT, decrement)
    .addNode(GENERATE, generateResponse)

    .addEdge(START, DECREMENT)
    .addConditionalEdges(DECREMENT, shouldContinue)
    .addEdge(GENERATE, END);

  return workflow.compile();
}

export function decrementTool() {
  const app = buildDecrementWorkflow();

  return new DynamicStructuredTool({
    name: "decrement",
    description: "decrement a number from a starting value to a lower value",
    schema: z.object({
      start: z.number(),
      minimum: z.number(),
    }),
    func: async (input: any) => {
      const chain = buildDecrementWorkflow();
      return chain.invoke(input);
    },
  });
}
