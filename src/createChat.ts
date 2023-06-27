import {
  type CompletionsOptions,
  type Message,
  createCompletions,
  Choice,
} from "./createCompletions";
import { retry } from "./retry";
import { omit } from "./omit";
import { createUserFunction, type UserFunction } from "./createUserFunction";
import Ajv, { AnySchemaObject } from "ajv";
import { type FromSchema } from "json-schema-to-ts";

type JsonValue =
  | JsonObject
  | JsonValue[]
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | null
  | undefined;

export type JsonObject = {
  [k: string]: string;
};

type Expectation = {
  examples: JsonObject[];
  schema: AnySchemaObject;
};

type MessageOptions = Partial<
  Omit<CompletionsOptions, "messages" | "n" | "functions">
> & {
  expect?: Expectation;
};

type StructuredChoice<T extends JsonObject> = Omit<Choice, "content"> & {
  content: T;
};

const extendPrompt = (prompt: string, expect: Expectation) => {
  return `${prompt}

Respond ONLY with a JSON object that satisfies the following schema:

${JSON.stringify(expect.schema, null, 2)}

Examples:

${expect.examples
  .map((example) => JSON.stringify(example, null, 2))
  .join("\n\n")}`;
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
  options: Omit<CompletionsOptions, "messages" | "n" | "onUpdate">
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

  const complete = async <T extends JsonObject>(
    messageOptions?: MessageOptions
  ) => {
    const response = await retry(() => {
      return createCompletions({
        messages,
        onUpdate: messageOptions?.onUpdate,
        ...options,
        ...messageOptions,
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

  const parseResponse = (choice: Choice, expect: Expectation) => {
    const parsed = JSON.parse(choice.content);

    const ajv = new Ajv();

    const validate = ajv.compile(expect.schema);

    const valid = validate(parsed);

    if (!valid) {
      throw new Error(`Invalid response: ${JSON.stringify(validate.errors)}`);
    }

    return {
      ...choice,
      content: parsed,
    } as any;
  };

  type SendMessageReturn<T> = T extends undefined
    ? Choice
    : StructuredChoice<FromSchema<T["expect"]["schema"]>>;

  function sendMessage<T extends MessageOptions>(
    prompt: string,
    messageOptions: T
  ): Promise<SendMessageReturn<T>>;
  function sendMessage(prompt: string): Promise<SendMessageReturn<undefined>>;

  async function sendMessage(prompt: string, messageOptions?: MessageOptions) {
    const message: Message = {
      content: messageOptions?.expect
        ? extendPrompt(prompt, messageOptions.expect)
        : prompt,
      role: "user",
    };

    messages.push(message);

    let choice = await complete(messageOptions);

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

      choice = await complete(messageOptions);
    }

    // TypeScript can't properly narrow the type in the function body.
    // This is why we have to use `as any` here.
    if (messageOptions?.expect) {
      return parseResponse(choice, messageOptions.expect) as any;
    } else {
      return choice as any;
    }
  }

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
