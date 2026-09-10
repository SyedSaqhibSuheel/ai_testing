function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractRetryDelaySeconds(err: unknown): number | undefined {
  const message = err instanceof Error ? err.message : String(err);
  const match = message.match(/retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Number(match[1]) : undefined;
}

/**
 * Retries a rate-limited (429) LLM call with backoff. The free tiers of
 * Gemini/OpenAI/Anthropic all cap requests per minute, and the executor's
 * agentic loop fires several calls per scenario in quick succession, so
 * hitting this mid-run is routine on a free-tier key, not exceptional -
 * worth absorbing automatically rather than surfacing to the user as a
 * hard failure every time.
 */
export async function withRateLimitRetry<T>(fn: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      if (status !== 429 || attempt === maxAttempts) throw err;

      const delaySeconds = extractRetryDelaySeconds(err) ?? 20;
      const waitMs = Math.ceil(delaySeconds * 1000) + 2000; // small buffer past the provider's own estimate
      console.error(
        `Rate limited (attempt ${attempt}/${maxAttempts}) - waiting ${Math.round(waitMs / 1000)}s before retrying...`
      );
      await sleep(waitMs);
    }
  }
  throw lastError;
}
