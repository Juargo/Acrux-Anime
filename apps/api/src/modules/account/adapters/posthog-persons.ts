// Port to the people PostHog knows (ADR-0030): deleting the account deletes the person.
export interface AnalyticsPersons {
  deletePerson(distinctId: string): Promise<void>;
}

const TIMEOUT_MS = 10_000;

// POST /api/projects/{project}/persons/bulk_delete/ with a personal API key that has
// person:write. PostHog deletes the person asynchronously; its events stay, keyed by a
// salted id that no longer leads to anyone.
export function createPostHogPersons(options: {
  apiKey: string;
  projectId: string;
  host: string;
  fetchFn?: typeof fetch;
}): AnalyticsPersons {
  const fetchFn = options.fetchFn ?? fetch;
  const url = `${options.host.replace(/\/+$/, '')}/api/projects/${encodeURIComponent(
    options.projectId,
  )}/persons/bulk_delete/`;
  return {
    deletePerson: async (distinctId) => {
      const response = await fetchFn(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ distinct_ids: [distinctId] }),
        redirect: 'error',
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`PostHog answered ${response.status}`);
    },
  };
}
