"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import ReportRow from "./ReportRow";
import PendingReportRow from "./PendingReportRow";
import { ReportListItem } from "@/types";
import { getAuthHeaders } from "@/lib/client-auth";

const REPORT_DISPLAY_LIMIT = 100;

export default function ReportDashboard() {
  const [reports, setReports] = useState<ReportListItem[]>([]);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  useEffect(() => {
    async function loadReports() {
      try {
        const response = await fetch("/api/reports", {
          headers: getAuthHeaders(),
        });
        const data: ReportListItem[] = await response.json();
        setReports(data);
      } catch (error) {
        console.error("Failed to load reports:", error);
      }
    }
    loadReports();
  }, []);

  const matches = (r: ReportListItem) =>
    !normalizedQuery ||
    r.title.toLowerCase().includes(normalizedQuery) ||
    r.content.toLowerCase().includes(normalizedQuery) ||
    r.patientName.toLowerCase().includes(normalizedQuery) ||
    r.patientSurname.toLowerCase().includes(normalizedQuery) ||
    r.date.toLowerCase().includes(normalizedQuery);

  const pending = reports
    .filter((r) => !r.finalized && matches(r))
    .slice(0, REPORT_DISPLAY_LIMIT);
  const finalized = reports
    .filter((r) => r.finalized && matches(r))
    .slice(0, REPORT_DISPLAY_LIMIT);

  return (
    <div className="flex flex-col h-full gap-6">
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-semibold text-gray-950">Reports</h1>
        <p className="mb-5 text-sm text-gray-500">Search and review generated clinical reports.</p>

        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search reports..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm text-gray-700 outline-none transition focus:border-[#2CA6AE] focus:ring-2 focus:ring-[#2CA6AE]/20 focus:bg-white"
          />
        </div>
      </div>

      <section className="rounded-xl bg-white shadow-sm border border-gray-100">
        <header className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-950">Pending finalization</h2>
          <span className="text-xs text-gray-500">{pending.length}</span>
        </header>
        <table className="w-full">
          <thead className="bg-gray-50/80">
            <tr>
              <th className="py-3 px-4 text-left text-xs font-bold tracking-widest text-[#2CA6AE]">PATIENT</th>
              <th className="py-3 px-4 text-left text-xs font-bold tracking-widest text-[#2CA6AE]">DATE</th>
              <th className="py-3 px-4 text-left text-xs font-bold tracking-widest text-[#2CA6AE]">TITLE</th>
              <th className="py-3 px-4 text-right text-xs font-bold tracking-widest text-[#2CA6AE]">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {pending.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-sm text-gray-500">
                  No reports awaiting finalization.
                </td>
              </tr>
            ) : (
              pending.map((report) => (
                <PendingReportRow key={report.id} report={report} />
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="flex-1 overflow-y-auto rounded-xl bg-white shadow-sm border border-gray-100">
        <header className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-base font-semibold text-gray-950">Finalized</h2>
          <span className="text-xs text-gray-500">{finalized.length}</span>
        </header>
        <table className="w-full">
          <thead className="bg-gray-50/80 sticky top-0">
            <tr>
              <th className="w-14 py-4 pl-4 text-left text-xs font-bold tracking-widest text-gray-400"> </th>
              <th className="py-4 px-4 text-left text-xs font-bold tracking-widest text-[#2CA6AE]">PATIENT</th>
              <th className="py-4 px-4 text-left text-xs font-bold tracking-widest text-[#2CA6AE]">DATE</th>
              <th className="py-4 px-4 text-left text-xs font-bold tracking-widest text-[#2CA6AE]">TITLE</th>
            </tr>
          </thead>
          <tbody>
            {finalized.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-gray-500">
                  No finalized reports yet.
                </td>
              </tr>
            ) : (
              finalized.map((report) => (
                <ReportRow key={report.id} report={report} />
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
