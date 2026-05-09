"use client";

import { useState, useEffect, useCallback } from "react";
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

  if (!meta || sectionList.length === 0) return null;

  const activeSection = sectionList.find((s) => s.id === activeSectionId);
  const activeContent = contentCache[activeSectionId] ?? "";

  return (
    <div className="flex gap-4 h-full">

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
  );
}
