interface PromiseWithResolvers<T> {
  promise: Promise<T>;
  reject: () => void;
  resolve: (value?: T | PromiseLike<T>) => void;
}

interface PromiseConstructor {
  withResolvers: <T>() => PromiseWithResolvers<T>;
}
