import { useState } from 'react';
import { saveFile as browserSaveFile, EXPORT_FILE_NAME, fetchExport } from '../account-api';

/** Hook: downloads the export, and says whether it failed. */
export function useDataDownload(options: {
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
  saveFile?: ((blob: Blob, name: string) => void) | undefined;
}) {
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);
  async function download() {
    setDownloading(true);
    setFailed(false);
    try {
      const blob = await fetchExport(options.getToken, options.fetchFn);
      (options.saveFile ?? browserSaveFile)(blob, EXPORT_FILE_NAME);
    } catch {
      setFailed(true);
    } finally {
      setDownloading(false);
    }
  }
  return { download, downloading, failed };
}
