/** Open a generated report PDF in a new browser tab. */
export function openReportUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Download a generated report. Falls back to opening the public URL when the
 * file cannot be fetched as a blob (for example CORS on the public host).
 */
export async function downloadReportFile(url: string, fileName?: string) {
  const fallbackName = fileName?.trim() || "report.pdf";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error("Unable to download report.");
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = fallbackName;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    openReportUrl(url);
  }
}
