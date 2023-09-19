# Completions

Node.js SDK for interacting with [OpenAI Chat](https://chat.openai.com/) [Completions API](https://platform.openai.com/docs/api-reference/chat/create).

Demo:

https://replit.com/@LucGagan/Completions?v=1

This SDK makes it simple to:

- Implement chat in Node.js and browser
- [send and receive chat messages](#usage)
- [save and restore chat conversations](#resuming-conversations)
- [stream chat responses](#streaming-conversations)
- [cancel chat responses](#cancelling-responses)
- [override the API endpoint](#overriding-api)
- [per message option overrides](#per-message-option-overrides)
- [utilize chat functions](#utilizing-functions)

## Usage

`createChat` interacts with the [`/v1/chat/completions`](https://platform.openai.com/docs/api-reference/chat/create) API endpoint.

- It streams the response
- It tracks the conversations

```ts
import { createChat } from "completions";

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
const chat = createChat({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-3.5-turbo",
  // or:
  // model: 'gpt-4',
});

await chat.sendMessage("Ping");

// {
//   response: { role: 'assistant', content: 'Pong', finishReason: 'stop' }
// }
```

### Resuming conversations

```ts
const chat = createChat({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-3.5-turbo",
});

await chat.sendMessage("pick a random number");

// Gets all messages sent and received.
// This can be used to resume chat at a later time.
const messages = chat.getMessages();
```

```ts
const chat = createChat({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-3.5-turbo",
});

// `messages` comes from the earlier snippet.
for (const message of messages) {
  chat.addMessage(message);
}

await chat.sendMessage("what random number did you pick?");
```

### Streaming conversations

```ts
const chat = createChat({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-3.5-turbo",
});

await chat.sendMessage("continue the sequence: a b c", {
  onUpdate: (message) => {
    console.log(message);
  },
});
```

### Cancelling responses

When cancelling responses, you will want to handle the special `CancelledCompletionError` error.

```ts
import { createChat, CancelledCompletionError } from "completions";

const chat = createChat({
  apiKey: OPENAI_API_KEY,
  model: "gpt-3.5-turbo",
});

try {
  await chat.sendMessage("continue sequence: a b c", {
    onUpdate: ({ cancel }) => {
      cancel();
    },
  });
} catch (error) {
  if (error instanceof CancelledCompletion) {
    console.log("cancelled");
  }

  throw error;
}
```

### Overriding API

If you want to use `completions` library against another API endpoint that is compatible with the official API, you can do so by passing `apiUrl` parameter:

```ts
import { createChat, CancelledCompletionError } from "completions";

const chat = createChat({
  apiKey: '',
  apiUrl: 'https://ray.run/api/completions'
  model: "gpt-3.5-turbo",
});
```

### Per message option overrides

You can override most of the options for the chat on a per-message level. Examples of when this is useful is when you want to force a user facing response when using functions, or if you want to modify something like logit bias for a single message.

```ts
const chat = createChat({
  apiKey: OPENAI_API_KEY,
  model: "gpt-3.5-turbo",
});

const response = await chat.sendMessage(
  "what is the next token in this sequence: a b c",
  {
    maxTokens: 1,
    // token 34093 is "boo"
    logitBias: { "34093": 100 },
  }
);

console.log(response.content);
// boo
```

### Utilizing functions

The OpenAI chat models can embed functions directly into the system prompt in a special format such that the model has better understanding of them and can know when to use them. ([see more documentation](https://platform.openai.com/docs/guides/gpt/function-calling))

To use this feature you must define a prototype and provide a description for the function when you create the chat. The model will decide when it wants to use the function. It is up to you to implement the logic around checking if the model wants to use them.

```ts
import { createChat } from "completions";

const chat = createChat({
  apiKey: OPENAI_API_KEY,
  model: "gpt-3.5-turbo-0613",
  functions: [
    {
      name: "get_current_weather",
      description: "Get the current weather in a given location",
      parameters: {
        type: "object",
        properties: {
          location: {
            type: "string",
            description: "The city and state, e.g. San Francisco, CA",
          },
          unit: { type: "string", enum: ["celsius", "fahrenheit"] },
        },
        required: ["location"],
      },
      function: async ({ location }) => {
        return {
          location: "Albuquerque",
          temperature: "72",
          unit: "fahrenheit",
          forecast: ["sunny", "windy"],
        };
      },
    },
  ],
  functionCall: "auto",
});

const response = await chat.sendMessage("What is the weather in Albuquerque?");

console.log(response.content);
// "The weather in Albuquerque is 72 degrees fahrenheit, sunny with a light breeze."
```

### Getting structured response

If you require a structured response, you can provide the response schema.

```ts
import { createChat } from "completions";

const response = await chat.sendMessage("Suggest a random startup name", {
  expect: {
    // These are the examples of what the response should look like.
    examples: [
      {
        name: "OpenAI",
        domain: "openai.com",
      },
    ],
    // This is the schema that the response should satisfy.
    schema: {
      additionalProperties: false,
      type: "object",
      properties: {
        name: { type: "string" },
        domain: { type: "string" },
      },
      required: ["name", "domain"],
    },
  },
});
```

Behind the scenes, the SDK will use the `expect` parameter to generate a prompt that will be sent to the API. The prompt will look like this:

```markdown
Suggest a random startup name

Respond ONLY with a JSON object that satisfies the following schema:

{
"type": "object",
"properties": {
"name": { "type": "string" },
"domain": { "type": "string" },
},
"required": ["name", "domain"],
}

Examples:

{
"name": "OpenAI",
"domain": "openai.com"
}
```

The SDK will parse the response and validate it against the schema. If the response is invalid, it will throw an error. If the response is valid, it will return the response.

```ts
response.content;
// {
//   name: "Dex",
//   domain: "dex.com",
// }
```

## My other projects

- [Developer Utilities](https://ray.run/tools)

## Running tests

```bash
export OPENAI_API_KEY="..."

npm test
```
