"use client";

import { useState, useEffect, useCallback} from "react";
import { Download, Eye, CheckCircle, AlertCircle, Loader } from "lucide-react";
import SectionNav from "./SectionNav";
import SectionEditor from "./SectionEditor";
import type { ReportMeta, ReportSectionSummary } from "@/types";
import { getAuthHeaders } from "@/lib/client-auth";

const SECTION_STATE_LIMIT = 80;

export default function ReportLayout({ reportId }: { reportId: string }) {
  const [meta, setMeta] = useState<ReportMeta | null>(null);
  const [sectionList, setSectionList] = useState<ReportSectionSummary[]>([]);
  const [contentCache, setContentCache] = useState<Record<string, string>>({});
  const [activeSectionId, setActiveSectionId] = useState<string>("");
  const [editingSectionId, setEditingSectionId] = useState<string>("");
  
  // PDF preview and finalize state
  const [isPreviewingPdf, setIsPreviewingPdf] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);

  const fetchSectionContent = useCallback(async (sectionId: string) => {
    if (contentCache[sectionId] !== undefined) return;

    try {
      const res = await fetch(`/api/reports/${reportId}/sections/${sectionId}`, {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      setContentCache((prev) => ({ ...prev, [sectionId]: data.content ?? "" }));
    } catch (error) {
      console.error("Failed to load section content:", error);
    }
  }, [contentCache, reportId]);

  useEffect(() => {
    async function loadReport() {
      try {
        const [metaResponse, sectionsRes] = await Promise.all([
          fetch(`/api/reports/${reportId}`, { headers: getAuthHeaders() }),
          fetch(`/api/reports/${reportId}/sections`, { headers: getAuthHeaders() }),
        ]);

        const metaData: ReportMeta = await metaResponse.json();
        const sectionsData: ReportSectionSummary[] = await sectionsRes.json();

        setMeta(metaData);
        setSectionList(sectionsData);

        if (sectionsData.length > 0) {
          const firstId = sectionsData[0].id;
          setActiveSectionId(firstId);
          fetchSectionContent(firstId);
        }
      } catch (error) {
        console.error("Failed to load report:", error);
      }
    }
    loadReport();
  }, [reportId, fetchSectionContent]);

  function handleSelectSection(id: string) {
    setEditingSectionId("");
    setActiveSectionId(id);
    fetchSectionContent(id);
  }

  async function handleAccept(id: string, content: string) {
    try {
      await fetch(`/api/reports/${reportId}/sections/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ status: "accepted", content }),
      });
    } catch (error) {
      console.error("Failed to save section:", error);
      return;
    }

    const updatedSections = sectionList.slice(0, SECTION_STATE_LIMIT).map((section) =>
      section.id === id ? { ...section, status: "accepted" as const } : section
    );

    setSectionList(updatedSections);
    setContentCache((prev) => ({ ...prev, [id]: content }));
    setEditingSectionId("");

    const currentIndex = updatedSections.findIndex((section) => section.id === id);
    const nextPending = updatedSections
      .slice(currentIndex + 1, currentIndex + 8)
      .find((section) => section.status === "pending");

    if (nextPending) handleSelectSection(nextPending.id);
  }

  async function handlePreviewPdf() {
    setIsPreviewingPdf(true);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/reports/${reportId}/generate-pdf-preview`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to generate PDF preview");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const opened = window.open(url, "_blank");
      if (!opened) {
        // Popup blocked — fall back to a download.
        const link = document.createElement("a");
        link.href = url;
        link.download = `report-${reportId}-preview.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      // Revoke after the browser has had a chance to load the blob.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      setStatusMessage({ type: "success", message: "PDF preview opened in a new tab." });
    } catch (error) {
      setStatusMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to generate PDF preview",
      });
    } finally {
      setIsPreviewingPdf(false);
    }
  }

  async function handleFinalizeReport() {
    const suggestedName = `report-${reportId}.pdf`;

    // showSaveFilePicker must run inside the user gesture, before any await.
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
            { description: "PDF document", accept: { "application/pdf": [".pdf"] } },
          ],
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.warn("showSaveFilePicker failed, falling back:", err);
        handle = null;
      }
    }

    setIsFinalizing(true);
    setStatusMessage(null);
    try {
      const response = await fetch(`/api/reports/${reportId}/finalize-and-generate-pdf`, {
        method: "POST",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to finalize report");
      }

      const blob = await response.blob();

      if (handle) {
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = suggestedName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }

      setStatusMessage({ type: "success", message: "Report finalized and PDF saved." });
    } catch (error) {
      setStatusMessage({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to finalize report",
      });
    } finally {
      setIsFinalizing(false);
    }
  }

  if (!meta || sectionList.length === 0) return null;

  const activeSection = sectionList.find((s) => s.id === activeSectionId);
  const activeContent = contentCache[activeSectionId] ?? "";
  const allSectionsAccepted = sectionList.every((s) => s.status === "accepted");
  const canFinalize = allSectionsAccepted;

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Status Messages */}
      {statusMessage && (
        <div
          className={`px-4 py-3 rounded-lg flex items-center gap-2 ${
            statusMessage.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {statusMessage.type === "success" ? (
            <CheckCircle className="w-5 h-5 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0" />
          )}
          <span className="text-sm font-medium">{statusMessage.message}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 px-4">
        <button
          onClick={handlePreviewPdf}
          disabled={isPreviewingPdf}
          className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-200 hover:bg-blue-100 disabled:opacity-50"
        >
          {isPreviewingPdf ? <Loader className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          Preview PDF
        </button>

        <button
          onClick={handleFinalizeReport}
          disabled={!canFinalize || isFinalizing}
          className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-lg border border-green-200 hover:bg-green-100 disabled:opacity-50"
          title={!canFinalize ? "All sections must be accepted first" : ""}
        >
          {isFinalizing ? <Loader className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
          Finalize & Generate PDF
        </button>
      </div>

      {/* Main Content */}
      <div className="flex gap-4 h-full flex-1 min-h-0 px-4">
        <aside className="w-72 shrink-0 flex flex-col h-full overflow-hidden">
          <SectionNav
            meta={meta}
            sections={sectionList}
            activeSectionId={activeSectionId}
            onSelectSection={handleSelectSection}
          />
        </aside>

        <main className="flex-1 min-w-0 h-full overflow-hidden">
          {activeSection && (
            <SectionEditor
              key={activeSectionId}
              section={activeSection}
              content={activeContent}
              isEditing={editingSectionId === activeSectionId}
              onAccept={handleAccept}
              onEdit={setEditingSectionId}
            />
          )}
        </main>
      </div>
    </div>
  );
}
