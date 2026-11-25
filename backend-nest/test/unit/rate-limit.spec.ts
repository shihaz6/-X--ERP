import { RateLimiter } from '../../src/common/rate-limit';

describe('RateLimiter', () => {
  let now = 0;
  const clock = () => now;

  beforeEach(() => {
    now = 1_000_000;
  });

  it('allows attempts below the limit and blocks at the limit', () => {
    const limiter = new RateLimiter(3, 60_000, clock);
    limiter.fail('a');
    limiter.fail('a');
    expect(limiter.retryAfterSeconds('a')).toBe(0);
    limiter.fail('a');
    expect(limiter.retryAfterSeconds('a')).toBe(60);
  });

  it('unblocks when the window passes', () => {
    const limiter = new RateLimiter(1, 60_000, clock);
    limiter.fail('a');
    expect(limiter.retryAfterSeconds('a')).toBeGreaterThan(0);
    now += 60_001;
    expect(limiter.retryAfterSeconds('a')).toBe(0);
  });

  it('keeps keys separate', () => {
    const limiter = new RateLimiter(1, 60_000, clock);
    limiter.fail('a');
    expect(limiter.retryAfterSeconds('a')).toBeGreaterThan(0);
    expect(limiter.retryAfterSeconds('b')).toBe(0);
  });

  it('clears a key on reset, as after a successful sign-in', () => {
    const limiter = new RateLimiter(2, 60_000, clock);
    limiter.fail('a');
    limiter.fail('a');
    limiter.reset('a');
    expect(limiter.retryAfterSeconds('a')).toBe(0);
  });
});
