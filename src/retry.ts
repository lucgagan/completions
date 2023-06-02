import { CancelledCompletionError } from "./errors";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const retry = async <T extends () => Promise<any>>(
  routine: T
): Promise<Awaited<ReturnType<T>>> => {
  let retries = 3;
  let attempts = 0;

  while (attempts++ < retries) {
    try {
      return await routine();
    } catch (error) {
      if (error instanceof CancelledCompletionError) {
        throw error;
      }

      if (retries === 0) {
        throw error;
      }

      console.warn(`retrying after error: ${error.message}`);
    }

    await delay(1000);
  }

  throw new Error("Expected to never reach this point");
};
