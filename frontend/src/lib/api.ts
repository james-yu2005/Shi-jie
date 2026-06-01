// Default SWR fetcher: GET a same-origin JSON route.
export const swrFetcher = <T>(path: string): Promise<T> => apiJson<T>(path);

// Browser-side fetch helper for same-origin /api routes.
// Serialises a JSON body, parses the JSON response, and throws a clean
// Error (using the route's `error` field when present) on non-2xx.
export async function apiJson<T>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.json !== undefined) headers.set("content-type", "application/json");
  const res = await fetch(path, {
    ...init,
    headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON (or empty) body
  }

  if (!res.ok) {
    const err =
      data && typeof data === "object" && "error" in data
        ? (data as { error: unknown }).error
        : null;
    throw new Error(
      err == null
        ? `HTTP ${res.status}`
        : typeof err === "string"
          ? err
          : JSON.stringify(err),
    );
  }
  return data as T;
}
