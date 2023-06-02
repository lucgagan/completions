import { CustomError } from "ts-custom-error";
import { type Choice } from "./createCompletions";

export class CancelledCompletionError extends CustomError {
  public constructor(public choices: Choice[]) {
    super("Completion was cancelled");
  }
}
