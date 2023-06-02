# Completions

Node.js SDK for interacting with [OpenAI Chat](https://chat.openai.com/) [Completions API](https://platform.openai.com/docs/api-reference/chat/create).

This SDK makes it simple to:

- Implement chat in Node.js and browser
- [send and receive chat messages](#usage)
- [save and restore chat conversations](#resuming-conversations)
- [stream chat responses](#streaming-conversations)

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
 */
const chat = createChat({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-3.5-turbo",
  // or:
  // model: 'gpt-4',
});

await chat.sentMessage("Ping");

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

await chat.sentMessage("pick a random number");

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

await chat.sentMessage("what random number did you pick?");
```

### Streaming conversations

```ts
const chat = createChat({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-3.5-turbo",
});

await chat.sentMessage("continue the sequence: a b c", (message) => {
  console.log(message);
});
```

## My other projects

- [Developer Utilities](https://ray.run/tools)

## Running tests

```bash
export OPENAI_API_KEY="..."

npm test
```
