/**
 * Counts failed attempts per key in a fixed window and reports when a key is blocked.
 * State is kept in memory, so limits apply per running instance.
 */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = () => Date.now(),
  ) {}

  /** Seconds until the key may try again, or 0 when it is not blocked. */
  retryAfterSeconds(key: string): number {
    const h = this.hits.get(key);
    const t = this.now();
    if (!h || h.resetAt <= t || h.count < this.max) return 0;
    return Math.ceil((h.resetAt - t) / 1000);
  }

  /** Records one failed attempt for the key. */
  fail(key: string): void {
    const t = this.now();
    const h = this.hits.get(key);
    if (!h || h.resetAt <= t) {
      this.prune(t);
      this.hits.set(key, { count: 1, resetAt: t + this.windowMs });
    } else {
      h.count++;
    }
  }

  /** Forgets the key, e.g. after a successful sign-in. */
  reset(key: string): void {
    this.hits.delete(key);
  }

  private prune(t: number): void {
    if (this.hits.size < 10_000) return;
    for (const [k, v] of this.hits) {
      if (v.resetAt <= t) this.hits.delete(k);
    }
  }
}
