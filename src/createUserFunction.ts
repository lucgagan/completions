import { z } from "zod";
import Ajv from "ajv";

export const FunctionZodSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  // TODO This takes a json schema, so we should validate we have a valid json schema
  parameters: z.any(),
  function: z.function(),
});

export type UserFunctionOptions = z.infer<typeof FunctionZodSchema>;

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
