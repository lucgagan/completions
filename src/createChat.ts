import {
  type CompletionsOptions,
  type Message,
  type CompletionResponse,
  createCompletions,
} from "./createCompletions";
import { retry } from "./retry";

export const createChat = (
  options: Omit<Omit<Omit<CompletionsOptions, "messages">, "n">, "onMessage">
) => {
  const messages: Message[] = [];

  const sendMessage = async (
    prompt: string,
    onMessage?: CompletionsOptions["onMessage"]
  ) => {
    const message: Message = {
      content: prompt,
      role: "user",
    };

    messages.push(message);

    const result = await retry(() => {
      return createCompletions({
        messages,
        onMessage,
        ...options,
      });
    });

    if (!result) {
      throw new Error("No result");
    }

    const { choices } = result;

    if (choices.length === 0) {
      throw new Error("No choices returned");
    }

    const choice = choices[0];

    return choice;
  };

  const addMessage = (message: Message) => {
    messages.push(message);
  };

  return {
    addMessage,
    getMessages: () => messages,
    sendMessage,
  };
};
