import { useState } from "react";
import { Card, Button, Badge } from "@/components/ui";
import { FileText, Copy, Check, Clock } from "lucide-react";
import { formatDuration } from "@/utils/formatDuration";

interface FullTranscriptCardProps {
  text: string;
  duration?: number;
  isDenoised?: boolean;
}

export function FullTranscriptCard({ text, duration, isDenoised }: FullTranscriptCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const wordCount = text ? text.trim().split(/\s+/).length : 0;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-[#9B69FF] shrink-0" />
          <h2 className="text-sm font-semibold text-[#F3F4F6]">Toàn Văn Phiên Âm</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isDenoised && <Badge variant="brand">Đã khử nhiễu</Badge>}
          {duration !== undefined && duration > 0 && (
            <span className="flex items-center gap-1 text-xs font-mono text-[#9CA3AF]">
              <Clock className="h-3 w-3" />
              {formatDuration(duration)}
            </span>
          )}
          <span className="text-xs font-mono text-[#9CA3AF]">{wordCount} từ</span>
          <Button variant="secondary" size="sm" onClick={handleCopy} disabled={!text}>
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? "Đã sao chép!" : "Sao chép"}</span>
          </Button>
        </div>
      </div>

      <div className="p-4 rounded-[10px] bg-[#0E0F14]/60 border border-white/[0.06] text-sm text-[#F3F4F6] leading-relaxed max-h-[160px] overflow-y-auto font-sans select-text">
        {text ? (
          text
        ) : (
          <span className="text-[#6B7280] italic">
            Chưa có nội dung phiên âm. Hãy chọn file hoặc ghi âm và bắt đầu xử lý.
          </span>
        )}
      </div>
    </Card>
  );
}
