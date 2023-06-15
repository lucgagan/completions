import * as dotenv from "dotenv";
import { join } from "path";
import { createChat } from "./createChat";
import { strict as assert } from "node:assert";
import { test } from "node:test";

dotenv.config({ path: join(__dirname, "..", ".env") });

const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
  throw new Error("OPENAI_API_KEY must be set");
}

test("Adds a function to the chat model and calls it, then does one more message for completeness", async () => {
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

  assert(
    response.role === "assistant" &&
      response.function_call?.name === "get_current_weather"
  );

  const response2 = await chat.sendMessage(
    JSON.stringify({
      location: "Albuquerque",
      temperature: "72",
      unit: "fahrenheit",
      forecast: ["sunny", "windy"],
    }),
    undefined,
    "get_current_weather"
  );

  assert(response2.content?.length > 0 && response2.role === "assistant");

  const response3 = await chat.sendMessage(
    "Is this too hot to have a pet polar bear?"
  );

  // console.log(response3.content);

  assert(/yes/i.test(response3.content));
});
