import { useState } from 'react';
import { saveFile as browserSaveFile, EXPORT_FILE_NAME, fetchExport } from '../account-api';
import { errorCode } from '../api-errors';

/** Hook: downloads the export, and says whether it failed and with which API code (ADR-0023). */
export function useDataDownload(options: {
  getToken: () => Promise<string | null>;
  fetchFn?: typeof fetch | undefined;
  saveFile?: ((blob: Blob, name: string) => void) | undefined;
}) {
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [code, setCode] = useState<string | undefined>();
  async function download() {
    setDownloading(true);
    setFailed(false);
    setCode(undefined);
    try {
      const blob = await fetchExport(options.getToken, options.fetchFn);
      (options.saveFile ?? browserSaveFile)(blob, EXPORT_FILE_NAME);
    } catch (error) {
      setCode(errorCode(error));
      setFailed(true);
    } finally {
      setDownloading(false);
    }
  }
  return { download, downloading, failed, code };
}
