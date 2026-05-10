"use client";

import { useState } from "react";
import { MoreHorizontal, Download, FileText, Loader } from "lucide-react";
import type { ReportRowProps as Props } from "@/types";
import { useRouter } from "next/navigation"; 
import { Pencil } from "lucide-react"

export default function ReportRow({ report }: Props) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  
  function handleDownloadPdf(event: React.MouseEvent<HTMLButtonElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
    // Create download link to the API endpoint
    const link = document.createElement("a");
    link.href = `/api/reports/download/${report.id}`;
    link.download = `report-${report.id}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleOpenEditor(event: React.MouseEvent<HTMLButtonElement>) {  
    event.currentTarget.closest("details")?.removeAttribute("open");  
    router.push(`/reports/${report.id}`);  
  }

  async function handleGeneratePdf(event: React.MouseEvent<HTMLButtonElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
    setIsGenerating(true);
    setGenerateError(null);
    
    try {
      const response = await fetch(
        `/api/reports/generate-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reportId: report.id }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate PDF");
      }

      const data = await response.json();
      alert(`PDF generated successfully!\nPath: ${data.pdf_path}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setGenerateError(errorMessage);
      console.error("Failed to generate PDF:", error);
      alert(`Error generating PDF: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
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
              onClick={handleGeneratePdf}
              disabled={isGenerating}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <Loader className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {isGenerating ? "Generating..." : "Generate PDF"}
            </button>

            <button
              onClick={handleDownloadPdf}
              className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-gray-700 transition hover:bg-gray-50"
            >
              <Download className="h-4 w-4" />
              Download PDF
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
