type EventHandler<TTarget> = ((this: TTarget, event: Event) => unknown) | null;

export type RequestController<T> = Readonly<{
  request: IDBRequest<T>;
  succeed(value: T): void;
  fail(error: DOMException): void;
}>;

export type TransactionController = Readonly<{
  transaction: IDBTransaction;
  complete(): void;
  abort(error: DOMException): void;
  fail(error: DOMException): void;
}>;

export type OpenController = Readonly<{
  factory: IDBFactory;
  succeed(database: IDBDatabase): void;
  fail(error: DOMException): void;
  block(): void;
}>;

function dispatch<TTarget extends object>(target: TTarget, handler: EventHandler<TTarget>): void {
  handler?.call(target, new Event("test"));
}

export function controlledRequest<T>(): RequestController<T> {
  let result: T;
  let error: DOMException | null = null;
  const request = {
    onsuccess: null,
    onerror: null,
    get result() {
      return result;
    },
    get error() {
      return error;
    },
  } as unknown as IDBRequest<T>;

  return {
    request,
    succeed(value) {
      result = value;
      dispatch(request, request.onsuccess);
    },
    fail(nextError) {
      error = nextError;
      dispatch(request, request.onerror);
    },
  };
}

export function controlledTransaction(stores: ReadonlyMap<string, IDBObjectStore>): TransactionController {
  let error: DOMException | null = null;
  const transaction = {
    oncomplete: null,
    onabort: null,
    onerror: null,
    get error() {
      return error;
    },
    objectStore(name: string) {
      const store = stores.get(name);
      if (!store) throw new DOMException(`Unknown object store: ${name}`, "NotFoundError");
      return store;
    },
  } as unknown as IDBTransaction;

  return {
    transaction,
    complete() {
      dispatch(transaction, transaction.oncomplete);
    },
    abort(nextError) {
      error = nextError;
      dispatch(transaction, transaction.onabort);
    },
    fail(nextError) {
      error = nextError;
      dispatch(transaction, transaction.onerror);
    },
  };
}

export function controlledOpen(): OpenController {
  let result: IDBDatabase;
  let error: DOMException | null = null;
  const request = {
    onsuccess: null,
    onerror: null,
    onblocked: null,
    onupgradeneeded: null,
    get result() {
      return result;
    },
    get error() {
      return error;
    },
  } as unknown as IDBOpenDBRequest;
  const factory = {
    open() {
      return request;
    },
  } as unknown as IDBFactory;

  return {
    factory,
    succeed(database) {
      result = database;
      dispatch(request, request.onsuccess);
    },
    fail(nextError) {
      error = nextError;
      dispatch(request, request.onerror);
    },
    block() {
      dispatch(request, request.onblocked);
    },
  };
}

export function databaseWithTransaction(
  transactionFactory: (storeNames: string | string[], mode?: IDBTransactionMode) => IDBTransaction,
  close: () => void,
): IDBDatabase {
  return {
    transaction: transactionFactory,
    onversionchange: null,
    close,
  } as unknown as IDBDatabase;
}
