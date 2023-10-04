import { z } from "zod";
import { CancelledCompletionError, UnrecoverableRemoteError } from "./errors";
import { FunctionZodSchema, UserFunctionOptions } from "./createUserFunction";

const RoleZodSchema = z.enum(["system", "user", "assistant", "function"]);

type Role = "system" | "user" | "assistant" | "function";

const MessageZodSchema = z
  .object({
    content: z.string(),
    role: RoleZodSchema,
    name: z.string().optional(),
    function_call: z
      .object({
        name: z.string(),
        arguments: z.string(),
      })
      .optional(),
  })
  .strict();

export type Message = {
  content: string;
  role: Role;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
};

const ResponseChunkZodSchema = z
  .object({
    id: z.string(),
    object: z.literal("chat.completion.chunk"),
    created: z.number(),
    model: z.string(),
    choices: z.array(
      z.object({
        index: z.number(),
        finish_reason: z.string().nullable(),
        delta: z.union([
          z.object({
            content: z.null().optional(),
            role: RoleZodSchema.optional(),
            function_call: z.object({
              name: z.string().optional(),
              arguments: z.string(),
            }),
          }),
          z.object({
            content: z.string(),
          }),
          z.object({
            role: RoleZodSchema,
          }),
          z.object({}),
        ]),
      })
    ),
  })
  .strict();

type ResponseChunk = {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: {
    index: number;
    finish_reason: string | null;
    delta:
      | {
          content: null;
          role?: Role;
          function_call?: {
            name?: string;
            arguments?: string;
          };
        }
      | {
          content: string;
        }
      | {
          role: Role;
        }
      | {};
  }[];
};

const CompletionsOptionsZodSchema = z
  .object({
    apiUrl: z.string().optional(),
    onUpdate: z
      .function()
      .args(
        z.object({
          cancel: z.function().returns(z.void()),
          message: ResponseChunkZodSchema,
        })
      )
      .returns(z.void())
      .optional(),
    apiKey: z.string(),
    model: z.string(),
    messages: z.array(MessageZodSchema),
    temperature: z.number().optional(),
    topP: z.number().optional(),
    n: z.number().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    frequencyPenalty: z.number().optional(),
    presencePenalty: z.number().optional(),
    logitBias: z.record(z.number()).optional(),
    maxTokens: z.number().optional(),
    user: z.string().optional(),
    functionCall: z
      .union([z.enum(["auto", "none"]), z.object({ name: z.string() })])
      .optional(),
    functions: z.array(FunctionZodSchema).optional(),
  })
  .strict();

type OnUpdate = (options: {
  cancel: () => void;
  message: ResponseChunk;
}) => void;

export type CompletionsOptions = {
  apiUrl?: string;
  onUpdate?: OnUpdate;
  apiKey: string;
  model: string;
  messages: Message[];
  temperature?: number;
  topP?: number;
  n?: number;
  stop?: string | string[];
  frequencyPenalty?: number;
  presencePenalty?: number;
  logitBias?: Record<string, number>;
  maxTokens?: number;
  user?: string;
  functionCall?: "auto" | "none" | { name: string };
  functions?: UserFunctionOptions[];
};

const ChoiceZodSchema = z
  .object({
    role: RoleZodSchema,
    content: z.string(),
    finishReason: z.string(),
    function_call: z
      .object({
        name: z.string(),
        arguments: z.string(),
      })
      .optional(),
  })
  .strict();

export type Choice = {
  role: Role;
  content: string;
  finishReason: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  functionCall?: {
    name: string;
    arguments: Record<string, any>;
  };
};

export type CompletionResponse = {
  choices: Choice[];
};

const consumeStream = async (stream: ReadableStream, onUpdate: OnUpdate) => {
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();

  const choices: Choice[] = [];

  let cancelled = false;

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    // {
    //   "error": {
    //     "message": "This model's maximum context length is 4097 tokens. However, your messages resulted in 5034 tokens. Please reduce the length of the messages.",
    //     "type": "invalid_request_error",
    //     "param": "messages",
    //     "code": "context_length_exceeded"
    //   }
    // }
    if (value.startsWith("{")) {
      await reader.cancel();

      // As far as I can tell, if the response is an object, then it is an unrecoverable error.
      throw new UnrecoverableRemoteError(value);
    }

    for (const chunk of value
      .split("\n")
      .map((chunk) => chunk.trim())
      .filter(Boolean)) {
      if (done) {
        break;
      }

      if (chunk === "") {
        continue;
      }

      if (chunk === "data: [DONE]") {
        await reader.cancel();

        break;
      }

      if (!chunk.startsWith("data: ")) {
        throw new Error(`Unexpected message: ${chunk}`);
      }

      let responseChunk;

      try {
        responseChunk = ResponseChunkZodSchema.parse(
          JSON.parse(chunk.slice("data: ".length))
        );
      } catch (error) {
        console.log('could not parse chunk:\n\n"""\n', chunk, '\n"""\n');
        console.log('read value:\n\n"""\n', value, '\n"""\n');
        console.error(error);

        await reader.cancel();
        throw error;
      }

      onUpdate({
        cancel: () => {
          cancelled = true;

          reader.cancel();
        },
        message: responseChunk,
      });

      for (const choiceChunk of responseChunk.choices) {
        const index = choiceChunk.index;

        const choice = (choices[index] = choices[index] ?? {});

        if (
          "finish_reason" in choiceChunk &&
          choiceChunk.finish_reason !== null
        ) {
          choice.finishReason = choiceChunk.finish_reason;
        }

        if ("role" in choiceChunk.delta) {
          choice.role = choiceChunk.delta.role as Role;
        }

        if ("content" in choiceChunk.delta) {
          choice.content = choice.content ?? "";
          choice.content += choiceChunk.delta.content;
        }

        if ("function_call" in choiceChunk.delta) {
          choice.function_call = choice.function_call ?? {
            name: "",
            arguments: "",
          };
          choice.function_call.name +=
            choiceChunk.delta.function_call.name ?? "";
          choice.function_call.arguments +=
            choiceChunk.delta.function_call.arguments ?? "";
        }
      }
    }
  }

  if (cancelled) {
    throw new CancelledCompletionError(choices);
  }

  return choices;
};

const parseResponse = (response: any) => {
  return response.choices.map((choice: any) => {
    const parsedChoice: Choice = {
      role: choice.message.role,
      // I've seen content to be null in case of a function call
      content: choice.message.content ?? "",
      finishReason: choice.finish_reason,
    };

    if (choice.message.function_call) {
      parsedChoice.function_call = {
        name: choice.message.function_call.name,
        arguments: choice.message.function_call.arguments,
      };
    }

    return parsedChoice;
  });
};

export const createCompletions = async (
  options: CompletionsOptions
): Promise<CompletionResponse> => {
  CompletionsOptionsZodSchema.parse(options);

  const response = await fetch(
    options.apiUrl ?? "https://api.openai.com/v1/chat/completions",
    {
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: options.messages,
        model: options.model,
        stream: Boolean(options.onUpdate),
        temperature: options.temperature,
        top_p: options.topP,
        n: options.n,
        stop: options.stop,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
        logit_bias: options.logitBias,
        max_tokens: options.maxTokens,
        user: options.user,
        function_call: options.functionCall,
        functions: options.functions,
      }),
      method: "POST",
    }
  );

  if (!response.body) {
    throw new Error("Expected response to have a body");
  }

  // {
  //   error: {
  //     message: "This model's maximum context length is 4097 tokens. However, your messages resulted in 4127 tokens (4091 in the messages, 36 in the functions). Please reduce the length of the messages or functions.",
  //     type: 'invalid_request_error',
  //     param: 'messages',
  //     code: 'context_length_exceeded'
  //   }
  // }
  if (response.status === 400) {
    throw new UnrecoverableRemoteError(await response.json());
  }

  const choices = options.onUpdate
    ? await consumeStream(response.body, options.onUpdate)
    : parseResponse(await response.json());

  // When replying to after a function return, the role is not set, so we need to set it ourselves.
  // I suspect that this is an oversight by the api since it requires the role be set in
  // the subsequent calls to the endpoint for the response message from the function.
  for (const choice of choices) {
    if (choice.role === undefined) {
      choice.role = "assistant";
    }
  }

  return {
    choices: ChoiceZodSchema.array().parse(choices),
  };
};
