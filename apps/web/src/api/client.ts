export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message ?? `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function postJson<T>(path: string, body?: unknown) {
  return apiFetch<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export function patchJson<T>(path: string, body: unknown) {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

export function deleteJson<T>(path: string) {
  return apiFetch<T>(path, { method: "DELETE" });
}
