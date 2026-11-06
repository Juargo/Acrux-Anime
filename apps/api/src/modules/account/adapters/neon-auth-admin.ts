// Port to the Neon Auth user directory (ADR-0034): the API key never leaves the server.
export interface AuthDirectory {
  // Resolves once the user can no longer sign in; a user already gone counts as deleted.
  deleteUser(userId: string): Promise<void>;
}

const TIMEOUT_MS = 10_000;

// DELETE /projects/{project}/branches/{branch}/auth/users/{user} of the Neon API. A DELETE
// is not retried here: the caller's whole deletion is idempotent, so the user retries it.
export function createNeonAuthAdmin(options: {
  apiKey: string;
  projectId: string;
  branchId: string;
  fetchFn?: typeof fetch;
}): AuthDirectory {
  const fetchFn = options.fetchFn ?? fetch;
  const base = `https://console.neon.tech/api/v2/projects/${encodeURIComponent(
    options.projectId,
  )}/branches/${encodeURIComponent(options.branchId)}/auth/users/`;
  return {
    deleteUser: async (userId) => {
      const response = await fetchFn(`${base}${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${options.apiKey}`, Accept: 'application/json' },
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok || response.status === 404) return;
      throw new Error(`Neon Auth answered ${response.status}`);
    },
  };
}
