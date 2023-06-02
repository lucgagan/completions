export const omit = <T extends object, K extends Extract<keyof T, string>>(
  object: T,
  targetKey: K
): Omit<T, K> => {
  const returnValue: any = {};

  for (const key in object) {
    if (key !== targetKey) {
      returnValue[key] = object[key];
    }
  }

  return returnValue;
};
