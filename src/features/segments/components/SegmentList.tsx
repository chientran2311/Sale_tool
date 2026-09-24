import React, { useState } from "react";
import { Card, Badge } from "@/components/ui";
import { ListFilter, PlayCircle, Search } from "lucide-react";
import type { AudioSegment } from "@/features/core";
import { cn } from "@/lib/utils";

interface SegmentListProps {
  segments: AudioSegment[] | null | undefined;
  currentTime?: number;
  onSeek: (seconds: number) => void;
}

export function SegmentList({ segments, currentTime = 0, onSeek }: SegmentListProps) {
  const [search, setSearch] = useState("");

  const filteredSegments = React.useMemo(() => {
    if (!segments) return [];
    if (!search.trim()) return segments;
    return segments.filter((s) => s.text.toLowerCase().includes(search.toLowerCase()));
  }, [segments, search]);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ListFilter className="h-4 w-4 text-[#266DF0] shrink-0" />
          <h2 className="text-sm font-semibold text-[#F3F4F6] truncate">Phân Đoạn Từng Câu</h2>
        </div>
        <Badge variant="mint" className="shrink-0 text-[10px]">Đồng bộ Audio</Badge>
      </div>

      {/* Search inside segments */}
      <div className="relative">
        <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-[#9CA3AF]" />
        <input
          type="text"
          placeholder="Tìm từ khóa trong các câu thoại..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-[#0E0F14] border border-white/[0.08] rounded-[8px] pl-9 pr-3 py-1.5 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-[#266DF0]"
        />
      </div>

      {/* List Container */}
      <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
        {(!segments || segments.length === 0) && (
          <div className="py-8 text-center text-xs text-[#6B7280] italic">
            Chưa có dữ liệu phân đoạn. Bật tùy chọn "Phân đoạn mốc thời gian" trước khi phiên âm.
          </div>
        )}

        {filteredSegments.map((seg) => {
          const isActive = currentTime >= seg.start && currentTime <= seg.end;

          return (
            <div
              key={seg.id}
              onClick={() => onSeek(seg.start)}
              className={cn(
                "group flex items-start gap-3 p-3 rounded-[10px] border transition-all cursor-pointer",
                isActive
                  ? "bg-[#266DF0]/10 border-[#266DF0]/40 shadow-[0_0_12px_rgba(38,109,240,0.15)]"
                  : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05] hover:border-white/[0.12]"
              )}
            >
              {/* Play icon on hover / active */}
              <div className="mt-0.5 shrink-0">
                <PlayCircle
                  className={cn(
                    "h-4 w-4 transition-colors",
                    isActive ? "text-[#266DF0]" : "text-[#6B7280] group-hover:text-[#F3F4F6]"
                  )}
                />
              </div>

              {/* Segment Content */}
              <div className="flex flex-col gap-1 overflow-hidden flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-white/[0.06] text-[#9CA3AF]">
                    {seg.start_formatted || `${seg.start.toFixed(1)}s`} - {seg.end_formatted || `${seg.end.toFixed(1)}s`}
                  </span>
                  <span className="text-[10px] text-[#6B7280]">#{seg.id}</span>
                </div>
                <p className="text-sm text-[#F3F4F6] leading-relaxed select-text">{seg.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
