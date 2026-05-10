"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReportRowProps as Props } from "@/types";

export default function PendingReportRow({ report }: Props) {
  const router = useRouter();

  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-4 pr-4 pl-4 text-sm text-gray-900">
        {report.patientName} {report.patientSurname}
      </td>
      <td className="py-4 pr-4 text-sm text-gray-500">{report.date}</td>
      <td className="py-4 pr-4 text-sm text-gray-900">{report.title}</td>
      <td className="py-4 pr-4 text-right">
        <button
          onClick={() => router.push(`/reports/${report.id}`)}
          className="inline-flex items-center gap-2 rounded-lg border border-[#2CA6AE] px-3 py-1.5 text-xs font-medium text-[#167980] transition hover:bg-[#E6F5F6]"
        >
          <Pencil className="h-3.5 w-3.5" />
          Open in editor
        </button>
      </td>
    </tr>
  );
}
