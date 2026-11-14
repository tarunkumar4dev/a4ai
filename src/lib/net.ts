// fetch with a timeout, the caller's AbortSignal and errors sorted into kinds a page can explain.
export type NetErrorKind = "timeout" | "offline" | "auth" | "notfound" | "server";

export class NetError extends Error {
  kind: NetErrorKind;
  status: number;
  constructor(kind: NetErrorKind, message: string, status = 0) {
    super(message);
    this.name = "NetError";
    this.kind = kind;
    this.status = status;
  }
}

export const NET_ERROR_TEXT: Record<NetErrorKind, string> = {
  timeout: "This is taking too long. Check your internet and try again.",
  offline: "You seem to be offline. Check your internet and try again.",
  auth: "Your session has expired. Please sign in again.",
  notfound: "We couldn't find that.",
  server: "Something went wrong. Please try again.",
};

/** GET JSON. A superseded request (caller aborted) rejects with an AbortError, never a NetError. */
export async function getJson<T>(url: string, signal?: AbortSignal, timeoutMs = 15_000, headers?: Record<string, string>): Promise<T> {
  const ctl = new AbortController();
  let timedOut = false;
  const t = setTimeout(() => { timedOut = true; ctl.abort(); }, timeoutMs);
  const onAbort = () => ctl.abort();
  if (signal?.aborted) ctl.abort();
  else signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(url, { signal: ctl.signal, headers });
    if (!res.ok) {
      const kind: NetErrorKind = res.status === 401 || res.status === 403 ? "auth" : res.status === 404 ? "notfound" : "server";
      throw new NetError(kind, NET_ERROR_TEXT[kind], res.status);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof NetError) throw e;
    if (timedOut) throw new NetError("timeout", NET_ERROR_TEXT.timeout);
    if ((e as Error)?.name === "AbortError") throw e;
    throw new NetError("offline", NET_ERROR_TEXT.offline); // fetch itself failed: network down / blocked
  } finally {
    clearTimeout(t);
    signal?.removeEventListener("abort", onAbort);
  }
}

export const retryNet = (count: number, err: unknown) =>
  count < 2 && err instanceof NetError && (err.kind === "timeout" || err.kind === "offline" || err.kind === "server");
