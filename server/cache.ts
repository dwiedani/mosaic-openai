import type { UsageSnapshot } from "../src/domain/usage";

/** Share host-wide reads. A caller's cancellation never aborts another caller's read. */
export class UsageCache {
  private cached?: UsageSnapshot;
  private cachedAt = 0;
  private pending?: Promise<UsageSnapshot>;
  private readonly controller = new AbortController();
  constructor(
    private readonly read: (signal: AbortSignal) => Promise<UsageSnapshot>,
    private readonly now = Date.now,
  ) {}
  async load(signal: AbortSignal): Promise<UsageSnapshot> {
    signal.throwIfAborted();
    this.controller.signal.throwIfAborted();
    if (this.cached && this.now() - this.cachedAt < 60000) return this.cached;
    if (!this.pending)
      this.pending = this.read(this.controller.signal)
        .then((snapshot) => {
          this.controller.signal.throwIfAborted();
          this.cached = snapshot;
          this.cachedAt = this.now();
          return snapshot;
        })
        .finally(() => {
          this.pending = undefined;
        });
    const pending = this.pending;
    return new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) abort();
      void pending
        .then(resolve, reject)
        .finally(() => signal.removeEventListener("abort", abort));
    });
  }
  async close(): Promise<void> {
    this.controller.abort();
    await this.pending?.catch(() => undefined);
    this.cached = undefined;
  }
}
