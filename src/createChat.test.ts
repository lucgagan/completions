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
