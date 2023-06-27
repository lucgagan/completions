import { z } from "zod";
import Ajv, { AnySchemaObject } from "ajv";

export const FunctionZodSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.custom<AnySchemaObject>(),
  function: z.function(),
});

export type UserFunctionOptions = {
  name: string;
  description?: string;
  parameters: AnySchemaObject;
  function: (...args: any[]) => any;
};

export type UserFunction = ReturnType<typeof createUserFunction>;

export const createUserFunction = (options: UserFunctionOptions) => {
  const { name, description, parameters } = FunctionZodSchema.parse(options);

  return {
    name,
    description,
    parameters,
    function: options.function,
    parseArguments: (argsString: string) => {
      const args = JSON.parse(argsString);

      const ajv = new Ajv();

      const validate = ajv.compile(parameters);

      const valid = validate(args);

      if (!valid) {
        throw new Error(
          `Invalid arguments: ${JSON.stringify(validate.errors)}`
        );
      }

      return args;
    },
  };
};
