import { dedent } from 'ts-dedent'

export function once<T extends (...args: any[]) => any>(fn: T): T {
  let called = false;
  let value: ReturnType<T>;

  const wrapper: (...args: Parameters<T>) => ReturnType<T> = (...args: Parameters<T>): ReturnType<T> => {
      if (!called) {
          called = true;
          value = fn(...args);
      }
      return value;
  };

  return wrapper as T;
}

export function deprecate(message: string) {
  return once(() => {
    console.warn(dedent(message));
  });
}