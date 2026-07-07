import { useEffect, useRef } from "hono/jsx";

// Exponential backoff bounds for the polling loop.
// When the server returns an error or the request fails, we wait longer
// before retrying (capped) to avoid hammering an unhealthy backend.
const BACKOFF_INITIAL_MS = 5_000;
const BACKOFF_MAX_MS = 60_000;

/**
 * Chain-style polling hook.
 *
 * Behavior:
 *   - Fetches immediately when activated
 *   - Waits for response before scheduling the next fetch (no overlapping requests)
 *   - Each subsequent fetch is delayed by `delay` ms
 *   - Supports AbortController to instantly cancel in-flight fetch when deactivated
 *   - On error/failure, applies exponential backoff (5s → 60s cap) and reports
 *     a backoff state via `onBackoff` so the UI can show "等待重试中…"
 *   - A successful response resets the backoff to `delay`
 *   - Loops indefinitely until user manually stops (even on terminal states like success/failure)
 *   - `restartToken`: when this value changes, the current polling cycle is
 *     aborted and a new cycle starts immediately (even if waiting in the delay gap).
 *
 * The loop restarts when `active`, `jobName`, `url`, or `restartToken` changes.
 * When `active` becomes false or `jobName` becomes null, any in-flight request
 * is aborted and the next scheduled fetch is cleared.
 */
export function useChainPolling(options: {
	active: boolean;
	jobName: string | null | undefined;
	onResult: (info: unknown) => void;
	onError: (error: string) => void;
	onBackoff?: (info: { nextDelayMs: number; attempt: number }) => void;
	delay?: number;
	url?: string;
	restartToken?: number | undefined;
}): void {
	const {
		active,
		jobName,
		onResult,
		onError,
		onBackoff,
		delay = 60_000,
		url,
		restartToken,
	} = options;

	// Keep latest callbacks/delay in refs so the loop doesn't restart on their change
	const callbacksRef = useRef({
		onResult,
		onError,
		onBackoff,
		delay,
	});
	callbacksRef.current = { onResult, onError, onBackoff, delay };

	useEffect(() => {
		if (!active || !jobName) return;

		let cancelled = false;
		const ctrl = new AbortController();
		let backoffMs = 0;
		let attempt = 0;

		const targetUrl =
			url ?? `/watch/api/jenkins/build?job=${encodeURIComponent(jobName)}`;

		const fetchOnce = async () => {
			const cb = callbacksRef.current;
			if (!cb) return;
			const isErrorAttempt = backoffMs > 0;
			try {
				const res = await fetch(targetUrl, { signal: ctrl.signal });
				const data = (await res.json()) as { error?: string } | unknown;
				if (cancelled) return;
				const err = (data as { error?: string })?.error;
				if (err) {
					attempt += 1;
					backoffMs = Math.min(
						backoffMs > 0 ? backoffMs * 2 : BACKOFF_INITIAL_MS,
						BACKOFF_MAX_MS,
					);
					cb.onError(err);
					cb.onBackoff?.({ nextDelayMs: backoffMs, attempt });
				} else {
					backoffMs = 0;
					attempt = 0;
					cb.onResult(data);
				}
			} catch (e) {
				if (cancelled) return;
				if ((e as Error).name === "AbortError") return;
				attempt += 1;
				backoffMs = Math.min(
					backoffMs > 0 ? backoffMs * 2 : BACKOFF_INITIAL_MS,
					BACKOFF_MAX_MS,
				);
				cb.onError(e instanceof Error ? e.message : String(e));
				cb.onBackoff?.({ nextDelayMs: backoffMs, attempt });
			}
			if (cancelled) return;
			const wait = isErrorAttempt ? backoffMs : cb.delay;
			window.setTimeout(fetchOnce, wait);
		};

		fetchOnce();

		return () => {
			cancelled = true;
			ctrl.abort();
		};
	}, [active, jobName, url, restartToken]);
}
