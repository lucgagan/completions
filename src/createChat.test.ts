import { strict as assert } from "node:assert";
import { test, mock } from "node:test";
import { createChat } from "./createChat";
import { Message } from "./createCompletions";
import dotenv from "dotenv";
import { join } from "path";

dotenv.config({ path: join(__dirname, "..", ".env") });

const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set");
}

test("sends a message and receives a response", async () => {
  const chat = createChat({
    apiKey: OPENAI_API_KEY,
    model: "gpt-3.5-turbo",
  });

  const response = await chat.sendMessage('respond with "pong"');

  assert.match(response.content, /pong/i);
});

test("remembers conversation", async () => {
  const chat = createChat({
    apiKey: OPENAI_API_KEY,
    model: "gpt-3.5-turbo",
  });

  await chat.sendMessage("My name is John");

  const response = await chat.sendMessage("What is my name?");

  assert.match(response.content, /John/);
});

test("streams progress", async () => {
  const chat = createChat({
    apiKey: OPENAI_API_KEY,
    model: "gpt-3.5-turbo",
  });

  const onMessage = mock.fn((message) => {
    console.log(message);
  });

  await chat.sendMessage("continue sequence: a b c", onMessage);

  assert.ok(onMessage.mock.calls.length > 0);
});

test("get messages", async () => {
  const chat = createChat({
    apiKey: OPENAI_API_KEY,
    model: "gpt-3.5-turbo",
  });

  await chat.sendMessage('respond with "pong"');

  const messages = chat.getMessages();

  assert.equal(messages.length, 2);
});

test("restore conversation", async () => {
  const chat = createChat({
    apiKey: OPENAI_API_KEY,
    model: "gpt-3.5-turbo",
  });

  const chatLog: Message[] = [
    {
      content: "what number comes after 2133",
      role: "user",
    },
    { role: "assistant", content: "2134" },
  ];

  for (const message of chatLog) {
    chat.addMessage(message);
  }

  const response = await chat.sendMessage("repeat the last answer");

  assert.match(response.content, /2134/);
});

test("cancel response", async () => {
  const chat = createChat({
    apiKey: OPENAI_API_KEY,
    model: "gpt-3.5-turbo",
  });

  await assert.rejects(
    chat.sendMessage("continue sequence: a b c", ({ cancel }) => {
      cancel();
    })
  );
});

test("calls user defined function", async () => {
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

  const response = await chat.sendMessage(
    "What is the weather in Albuquerque?"
  );

  assert.equal(response.role, "assistant");
  assert.equal(response.function_call?.name, "get_current_weather");
});

test("overrides function call", async () => {
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

  const response1 = await chat.sendMessage(
    JSON.stringify({
      location: "Albuquerque",
      temperature: "72",
      unit: "fahrenheit",
      forecast: ["sunny", "windy"],
    }),
    undefined,
    "get_current_weather"
  );

  assert.equal(response1.role, "assistant");
  assert.match(response1.content, /the current weather in Albuquerque/i);

  const response2 = await chat.sendMessage(
    "Is this too hot to have a pet polar bear?"
  );

  assert.match(response2.content, /yes/i);

  // Test option overriding to force the user facing response
  const response3 = await chat.sendMessage(
    "What is the weather in Chicago?",
    undefined,
    undefined,
    {
      functionCall: "none",
    }
  );

  // Expecting a variation of:
  // Apologies, but I cannot provide real-time data.
  // I'm sorry, but I am currently not able to provide real-time weather information.
  assert.match(response3.content, /(sorry|cannot)/i);
  assert.equal(response3.role, "assistant");
  assert.equal(response3.function_call, undefined);
});
