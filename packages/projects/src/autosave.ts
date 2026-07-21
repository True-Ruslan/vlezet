export type SaveStatus =
  | Readonly<{ kind: "idle" }>
  | Readonly<{ kind: "saving" }>
  | Readonly<{ kind: "saved"; savedAt: string }>
  | Readonly<{ kind: "failed"; message: string }>;

export type AutosaveCoordinatorOptions<T> = Readonly<{
  delayMs: number;
  save: (value: T) => Promise<void>;
  onStatus: (status: SaveStatus) => void;
  now?: () => string;
  failureMessage?: string;
}>;

export class AutosaveCoordinator<T> {
  readonly #delayMs: number;
  readonly #save: (value: T) => Promise<void>;
  readonly #onStatus: (status: SaveStatus) => void;
  readonly #now: () => string;
  readonly #failureMessage: string;
  #timer: ReturnType<typeof setTimeout> | null = null;
  #pending: T | undefined;
  #failed: T | undefined;
  #active: Promise<void> | null = null;
  #disposed = false;

  constructor(options: AutosaveCoordinatorOptions<T>) {
    if (!Number.isFinite(options.delayMs) || options.delayMs < 0) {
      throw new RangeError("Autosave delay must be a non-negative finite number");
    }
    this.#delayMs = options.delayMs;
    this.#save = options.save;
    this.#onStatus = options.onStatus;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#failureMessage = options.failureMessage ?? "Не удалось сохранить проект.";
    this.#onStatus({ kind: "idle" });
  }

  schedule(value: T): void {
    if (this.#disposed) return;
    this.#pending = value;
    this.#failed = undefined;
    this.#onStatus({ kind: "saving" });
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      this.#timer = null;
      void this.#drain().catch(() => undefined);
    }, this.#delayMs);
  }

  async flush(): Promise<void> {
    if (this.#disposed) return;
    if (this.#timer) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
    await this.#drain();
  }

  async retry(): Promise<void> {
    if (this.#disposed) return;
    if (this.#pending === undefined && this.#failed !== undefined) {
      this.#pending = this.#failed;
      this.#failed = undefined;
    }
    this.#onStatus({ kind: "saving" });
    await this.#drain();
  }

  dispose(): void {
    this.#disposed = true;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = null;
    this.#pending = undefined;
    this.#failed = undefined;
  }

  async #drain(): Promise<void> {
    if (this.#disposed) return;
    if (this.#active) {
      await this.#active;
      if (this.#pending !== undefined) await this.#drain();
      return;
    }
    if (this.#pending === undefined) {
      if (this.#failed !== undefined) throw new Error(this.#failureMessage);
      return;
    }

    const value = this.#pending;
    this.#pending = undefined;
    this.#onStatus({ kind: "saving" });

    this.#active = this.#save(value)
      .then(() => {
        this.#onStatus({ kind: "saved", savedAt: this.#now() });
      })
      .catch((error: unknown) => {
        this.#failed = this.#pending ?? value;
        this.#pending = undefined;
        this.#onStatus({ kind: "failed", message: this.#failureMessage });
        throw error;
      })
      .finally(() => {
        this.#active = null;
      });

    await this.#active;
    if (this.#pending !== undefined) await this.#drain();
  }
}
