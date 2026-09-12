export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error?.message ?? "Something went wrong.");
  }

  // DELETE routes return 204 No Content — there's no body to parse.
  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json();
  return body.data as T;
}
