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
 * @property functionCall - Whether or not the model is allowed to call a function.
 * @property functions - Specifications for functions which the model can call.
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

await chat.sendMessage("continue the sequence: a b c", (message) => {
  console.log(message);
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
  await chat.sendMessage("continue sequence: a b c", ({ cancel }) => {
    cancel();
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

### Utilizing Functions

The OpenAI chat models can embed functions directly into the system prompt in a special format such that the model has better understanding of them and can know when to use them. ([see more documentation](https://platform.openai.com/docs/guides/gpt/function-calling))

To use this feature you must define a prototype and provide a description for the function when you create the chat. The model will decide when it wants to use the function. It is up to you implement the logic around checking if the model wants to use them.

```ts
import { createChat } from "./createChat";

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
    },
  ],
  functionCall: "auto",
});

const responseWantingFunction = await chat.sendMessage("What is the weather in Albuquerque?");

if (responseWantingFunction.function_call?.name === "get_current_weather") {
  const response = await chat.sendMessage(
    JSON.stringify({
      location: "Albuquerque",
      temperature: "72",
      unit: "fahrenheit",
      forecast: ["sunny", "windy"],
    }),
    undefined,
    "get_current_weather"
  );

  console.log(response.content);
  // "The weather in Albuquerque is 72 degrees fahrenheit, sunny with a light breeze."
} else {
  // handle responses like normal otherwise
}

```

## My other projects

- [Developer Utilities](https://ray.run/tools)

## Running tests

```bash
export OPENAI_API_KEY="..."

npm test
```
