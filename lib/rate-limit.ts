// ponytail: per-instance in-memory counter, resets on cold start and isn't
// shared across Vercel instances. Speed bump against scripted abuse, not a
// hard guarantee. Swap for Upstash Redis (@upstash/ratelimit) if it proves
// insufficient once there's real traffic.
const buckets = new Map<string, { count: number; resetAt: number }>();

/** Returns true if the action is allowed, false if the caller is over the limit. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count++;
  return true;
}

export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
}
