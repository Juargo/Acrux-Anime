// Client for the holder's rights (#38, ADR-0028): GET /api/v1/me/export and DELETE /api/v1/me.

export const EXPORT_FILE_NAME = 'acrux-datos.json';

async function authorization(getToken: () => Promise<string | null>) {
  const token = await getToken();
  if (!token) throw new Error('Signed out');
  return { Authorization: `Bearer ${token}` };
}

// Everything Acrux keeps about the user, as the JSON file the API sends.
export async function fetchExport(
  getToken: () => Promise<string | null>,
  fetchFn: typeof fetch = fetch,
): Promise<Blob> {
  const response = await fetchFn('/api/v1/me/export', { headers: await authorization(getToken) });
  if (!response.ok) throw new Error(`Exporting the data failed with ${response.status}`);
  return new Blob([await response.text()], { type: 'application/json' });
}

// Idempotent on the API: after a failure, the same call finishes the deletion.
export async function deleteAccount(
  getToken: () => Promise<string | null>,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchFn('/api/v1/me', {
    method: 'DELETE',
    headers: await authorization(getToken),
  });
  if (!response.ok) throw new Error(`Deleting the account failed with ${response.status}`);
}

// Hands the file to the browser as a download.
export function saveFile(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
