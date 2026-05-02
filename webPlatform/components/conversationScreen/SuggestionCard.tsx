import { Lightbulb } from "lucide-react";
import type { SuggestionCardProps } from "@/types";

export default function SuggestionCard({
  content,
  timestamp,
  isNew,
}: SuggestionCardProps) {
  return (
    <article className="group relative rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
      {isNew && (
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#167980]" />
      )}

      <div className="flex items-start gap-3">
        <div className="mt-1 rounded-lg bg-[#FFF4E6] p-2">
          <Lightbulb className="h-4 w-4 text-[#FFB84D]" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-foreground leading-relaxed">{content}</p>

          <div className="mt-3 flex items-center gap-3 text-sm text-muted-foreground">
            <span className="text-border">•</span>
            <time className="text-xs text-muted-foreground">
              {formatTime(timestamp)}
            </time>
          </div>
        </div>
      </div>
    </article>
  );
}

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return date.toLocaleDateString();
}
