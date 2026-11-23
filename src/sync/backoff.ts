/**
 * Calculates exponential backoff with jitter.
 *
 * @param attempt 0-indexed retry attempt
 * @param baseMs Initial delay in milliseconds (default: 1000ms)
 * @param maxMs Maximum delay in milliseconds (default: 30000ms)
 * @param randomFn Optional random generator for testing deterministic output
 * @returns delay in milliseconds
 */
export function getBackoffDelay(
  attempt: number,
  baseMs = 1000,
  maxMs = 30000,
  randomFn = Math.random,
): number {
  const exp = Math.min(maxMs, baseMs * Math.pow(2, Math.max(0, attempt)));
  // Apply 20% jitter: factor between 0.8 and 1.2
  const jitterFactor = 0.8 + randomFn() * 0.4;
  return Math.round(exp * jitterFactor);
}
