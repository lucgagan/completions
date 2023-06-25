import {
  type CompletionsOptions,
  type Message,
  createCompletions,
} from "./createCompletions";
import { retry } from "./retry";
import { omit } from "./omit";
import { createUserFunction, type UserFunction } from "./createUserFunction";

type MessageOptions = {
  functionName?: string;
  onUpdate?: CompletionsOptions["onUpdate"];
  options?: Partial<
    Omit<Omit<Omit<CompletionsOptions, "messages">, "n">, "functions">
  >;
};

/**
 * @property apiKey - OpenAI API key.
 * @property frequencyPenalty - Number between -2.0 and 2.0. Positive values penalize new
 *    tokens based on their existing frequency in the text so far, decreasing the model's
 *    likelihood to repeat the same line verbatim.
 * @property logitBias - Number between -2.0 and 2.0. Positive values penalize new tokens
 *    based on their existing frequency in the text so far, decreasing the model's likelihood to
 *    repeat the same line verbatim.
 * @property maxTokens – The maximum number of tokens to generate in the chat completion.
 *    The total length of input tokens and generated tokens is limited by the model's context length.
 * @property model - ID of the model to use. See the model endpoint compatibility table for
 *    details on which models work with the Chat API.
 * @property functionCall - Controls how the model responds to function calls.
 *    "none" means the model does not call a function, and responds to the end-user.
 *    "auto" means the model can pick between an end-user or calling a function.
 *    Specifying a particular function via {"name":\ "my_function"} forces the model to call that function.
 *    "none" is the default when no functions are present.
 *    "auto" is the default if functions are present.
 * @property functions - A list of functions the model may generate JSON inputs for.
 * @property n - How many chat completion choices to generate for each input message.
 * @property presencePenalty - Number between -2.0 and 2.0. Positive values penalize new
 *    tokens based on whether they appear in the text so far, increasing the model's
 *    likelihood to talk about new topics.
 * @property stop - Up to 4 sequences where the API will stop generating further tokens.
 * @property temperature - What sampling temperature to use, between 0 and 2. Higher values
 *    like 0.8 will make the output more random, while lower values like 0.2 will make it
 *    more focused and deterministic.
 *    We generally recommend altering this or top_p but not both.
 * @property topP - An alternative to sampling with temperature, called nucleus sampling,
 *    where the model considers the results of the tokens with top_p probability mass.
 *    So 0.1 means only the tokens comprising the top 10% probability mass are considered.
 *    We generally recommend altering this or temperature but not both.
 * @property user - A unique identifier representing your end-user, which can help OpenAI
 *    to monitor and detect abuse.
 */
export const createChat = (
  options: Omit<Omit<Omit<CompletionsOptions, "messages">, "n">, "onUpdate">
) => {
  const messages: Message[] = [];

  const userFunctions: Record<string, UserFunction> = {};

  for (const functionOptions of options.functions || []) {
    userFunctions[functionOptions.name] = createUserFunction(functionOptions);
  }

  const callFunction = async (functionName: string, args: string) => {
    const userFunction = userFunctions[functionName];

    if (!userFunction) {
      throw new Error(`Function "${functionName}" not found in user functions`);
    }

    const result = await userFunction.function(
      userFunction.parseArguments(args)
    );

    return result;
  };

  const complete = async (messageOptions?: MessageOptions) => {
    const response = await retry(() => {
      return createCompletions({
        messages,
        onUpdate: messageOptions?.onUpdate,
        ...options,
        ...messageOptions?.options,
      });
    });

    if (!response) {
      throw new Error("No result");
    }

    const { choices } = response;

    if (choices.length === 0) {
      throw new Error("No choices returned");
    }

    if (choices.length > 1) {
      throw new Error("Expected only one choice");
    }

    const choice = choices[0];

    return choice;
  };

  const sendMessage = async (
    prompt: string,
    messageOptions?: MessageOptions
  ) => {
    const message: Message = {
      content: prompt,
      role: "user",
    };

    messages.push(message);

    const choice = await complete(messageOptions);

    messages.push(omit(choice, "finishReason"));

    if (choice.function_call) {
      const result = await callFunction(
        choice.function_call.name,
        choice.function_call.arguments
      );

      messages.push({
        content: JSON.stringify(result),
        role: "function",
        name: choice.function_call.name,
      });

      return complete(messageOptions);
    }

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

export type Chat = ReturnType<typeof createChat>;
