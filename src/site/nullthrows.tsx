export function nullthrows<T>(val: T | null | undefined): T {
  if (val == null) {
    throw new Error("nullthrows");
  }
  return val;
}
