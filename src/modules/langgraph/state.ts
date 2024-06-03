import { StateGraphArgs } from "@langchain/langgraph";
import { BaseMessage } from "langchain/schema";

export interface BaseGraphState {
  history: BaseMessage[];
  message: string;
  rephrased: string;
  generation: string | undefined;
}

export const baseGraphState: StateGraphArgs<BaseGraphState>["channels"] = {
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

  generation: {
    value: (left?: string, right?: string) => (right ? right : left),
    default: () => undefined,
  },
};
