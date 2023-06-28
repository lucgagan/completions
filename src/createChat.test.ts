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

  const onUpdate = mock.fn((message) => {
    console.log(message);
  });

  await chat.sendMessage("continue sequence: a b c", {
    onUpdate,
  });

  assert.ok(onUpdate.mock.calls.length > 0);
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
    chat.sendMessage("continue sequence: a b c", {
      onUpdate: ({ cancel }) => {
        cancel();
      },
    })
  );
});

test("calls user defined function", async () => {
  const getCurrentWeather = mock.fn(() => {
    return {
      location: "Albuquerque",
      temperature: "72",
      unit: "fahrenheit",
      forecast: ["sunny", "windy"],
    };
  });

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
        function: getCurrentWeather,
      },
    ],
    functionCall: "auto",
  });

  const response = await chat.sendMessage(
    "What is the weather in Albuquerque?"
  );

  assert.equal(response.role, "assistant");
  assert.match(
    response.content,
    /(the current weather in Albuquerque)|(weather in Albuquerque is currently)/i
  );
});

test("calls user identified function", async () => {
  const getCurrentWeatherV1 = mock.fn(() => {
    return {
      location: "Albuquerque",
      temperature: "72",
      unit: "fahrenheit",
      forecast: ["sunny", "windy"],
    };
  });

  const getCurrentWeatherV2 = mock.fn(() => {
    return {
      location: "Albuquerque",
      temperature: "72",
      unit: "fahrenheit",
      forecast: ["sunny", "windy"],
    };
  });

  const chat = createChat({
    apiKey: OPENAI_API_KEY,
    model: "gpt-3.5-turbo-0613",
    functions: [
      {
        name: "get_current_weather_v1",
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
        function: getCurrentWeatherV1,
      },
      {
        name: "get_current_weather_v2",
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
        function: getCurrentWeatherV2,
      },
    ],
    functionCall: "auto",
  });

  await chat.sendMessage("What is the weather in Albuquerque?", {
    functionCall: {
      name: "get_current_weather_v2",
    },
  });

  assert.equal(getCurrentWeatherV1.mock.calls.length, 0);
  assert.equal(getCurrentWeatherV2.mock.calls.length, 1);
});

test("overrides function call", async () => {
  const getCurrentWeather = mock.fn(() => {
    return {
      location: "Albuquerque",
      temperature: "72",
      unit: "fahrenheit",
      forecast: ["sunny", "windy"],
    };
  });

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
        function: getCurrentWeather,
      },
    ],
  });

  await chat.sendMessage("What is the weather in Chicago?", {
    functionCall: "none",
  });

  assert.equal(getCurrentWeather.mock.calls.length, 0);
});

test("overrides message options", async () => {
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

  assert.equal(response.finishReason, "length");
  assert.equal(response.content, "boo");
});

test("returns structured data", async () => {
  const chat = createChat({
    apiKey: OPENAI_API_KEY,
    model: "gpt-3.5-turbo",
  });

  const response = await chat.sendMessage("Suggest a random startup name", {
    expect: {
      examples: [
        {
          name: "OpenAI",
          domain: "openai.com",
        },
      ],
      schema: {
        additionalProperties: false,
        type: "object",
        properties: {
          name: { type: "string" },
          domain: { type: "string" },
        },
        required: ["name", "domain"],
      } as const,
    },
  });

  assert(typeof response.content === "object");
  assert("name" in response.content);
  assert("domain" in response.content);

  // force next version release
});
