import {
  type CompletionsOptions,
  type Message,
  createCompletions,
} from "./createCompletions";
import pRetry from "p-retry";

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

    const request = async () => {
      return await createCompletions({
        messages,
        onMessage,
        ...options,
      });
    };

    const { choices } = await pRetry(request, { retries: 3 });

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
