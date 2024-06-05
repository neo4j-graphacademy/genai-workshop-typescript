import { sleep } from "@/utils";
import { detectCommand } from "./commands";

type RunInput = {
  message: string;
};

// tag::call[]
export async function call(
  message: string,
  sessionId: string
): Promise<string> {
  // Detect slash commands
  const command = detectCommand(message, sessionId);

  if (typeof command === "string") {
    return command;
  }

  await sleep(1000);

  return message;
}
// end::call[]
