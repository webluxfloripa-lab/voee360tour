/** Avoid exposing raw provider errors and unintentional resend loops. */
export const ACCESS_RETRY_KEY = "voee360tour:email-access:retry-at";
export function retrySecondsFromError(error: unknown): number {
  if (!error || typeof error !== "object") return 0;
  const item = error as { message?: unknown; status?: unknown; code?: unknown };
  const message = typeof item.message === "string" ? item.message : "";
  const match = message.match(/after\s+(\d+)\s+seconds?/i);
  if (match) return Math.min(3600, Math.max(1, Number(match[1])));
  if (item.status === 429 || item.code === "over_email_send_rate_limit") return 60;
  return 0;
}
export function remainingSeconds(retryAt: number, now: number): number {
  return Math.max(0, Math.ceil((retryAt - now) / 1000));
}