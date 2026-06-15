import { useEffect, useRef } from "hono/jsx";

/**
 * Chain-style polling hook.
 *
 * Behavior:
 *   - Fetches immediately when activated
 *   - Waits for response before scheduling the next fetch (no overlapping requests)
 *   - Each subsequent fetch is delayed by `delay` ms
 *   - Supports AbortController to instantly cancel in-flight fetch when deactivated
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
	delay?: number;
	url?: string;
	restartToken?: number | undefined;
}): void {
	const {
		active,
		jobName,
		onResult,
		onError,
		delay = 60_000,
		url,
		restartToken,
	} = options;

	// Keep latest callbacks/delay in refs so the loop doesn't restart on their change
	const callbacksRef = useRef({ onResult, onError, delay });
	callbacksRef.current = { onResult, onError, delay };

	useEffect(() => {
		if (!active || !jobName) return;

		let cancelled = false;
		const ctrl = new AbortController();

		const targetUrl =
			url ?? `/watch/api/jenkins/build?job=${encodeURIComponent(jobName)}`;

		const fetchOnce = async () => {
			const cb = callbacksRef.current;
			if (!cb) return;
			try {
				const res = await fetch(targetUrl, { signal: ctrl.signal });
				const data = (await res.json()) as { error?: string } | unknown;
				if (cancelled) return;
				const err = (data as { error?: string })?.error;
				if (err) {
					cb.onError(err);
				} else {
					cb.onResult(data);
				}
			} catch (e) {
				if (cancelled) return;
				if ((e as Error).name === "AbortError") return;
				cb.onError(e instanceof Error ? e.message : String(e));
			}
			if (cancelled) return;
			window.setTimeout(fetchOnce, cb.delay);
		};

		fetchOnce();

		return () => {
			cancelled = true;
			ctrl.abort();
		};
	}, [active, jobName, url, restartToken]);
}
