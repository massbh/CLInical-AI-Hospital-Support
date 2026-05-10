"use client";

import { useState } from "react";
import { MoreHorizontal, Download, Loader, Pencil } from "lucide-react";
import type { ReportRowProps as Props } from "@/types";
import { useRouter } from "next/navigation";

export default function ReportRow({ report }: Props) {
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);

  function handleOpenEditor(event: React.MouseEvent<HTMLButtonElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
    router.push(`/reports/${report.id}`);
  }

  async function handleDownloadPdf(event: React.MouseEvent<HTMLButtonElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");

    const suggestedName = `report-${report.id}.pdf`;

    // showSaveFilePicker MUST be invoked synchronously inside the user gesture
    // — any await before it (like fetch) consumes the activation and Chromium
    // silently rejects the call. So: open the picker first, then fetch.
    const showSaveFilePicker = (
      window as unknown as {
        showSaveFilePicker?: (opts: {
          suggestedName: string;
          types: { description: string; accept: Record<string, string[]> }[];
        }) => Promise<FileSystemFileHandle>;
      }
    ).showSaveFilePicker;

    let handle: FileSystemFileHandle | null = null;
    if (typeof showSaveFilePicker === "function") {
      try {
        handle = await showSaveFilePicker({
          suggestedName,
          types: [
            {
              description: "PDF document",
              accept: { "application/pdf": [".pdf"] },
            },
          ],
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn("showSaveFilePicker failed, falling back:", err);
        handle = null;
      }
    }

    setIsDownloading(true);
    try {
      const response = await fetch(`/api/reports/generate-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: report.id }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to generate PDF");
      }

      const blob = await response.blob();

      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = suggestedName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Failed to download PDF:", error);
      alert(`Error downloading PDF: ${errorMessage}`);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-4 pr-4 pl-4">
        <details className="relative">
          <summary
            aria-label="Report actions"
            className="list-none rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 [&::-webkit-details-marker]:hidden"
          >
            <MoreHorizontal className="h-5 w-5" />
          </summary>

          <div className="absolute left-0 top-full z-10 mt-1 min-w-[160px] rounded-lg border border-gray-100 bg-white py-1 shadow-lg">
            <button
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isDownloading ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {isDownloading ? "Preparing..." : "Download PDF"}
            </button>

            <button
              onClick={handleOpenEditor}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" />
              Edit Report
            </button>
          </div>
        </details>
      </td>
      <td className="py-4 pr-4 text-sm text-gray-900">{report.patientName} {report.patientSurname}</td>
      <td className="py-4 pr-4 text-sm text-gray-500">{report.date}</td>
      <td className="py-4 text-sm text-gray-900">{report.title}</td>
    </tr>
  );
}
