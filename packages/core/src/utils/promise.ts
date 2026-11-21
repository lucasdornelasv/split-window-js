/** Whether a value is a promise or any other thenable. */
export function isPromiseLike<T = unknown>(value: unknown): value is PromiseLike<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PromiseLike<T>).then === 'function'
  );
}
