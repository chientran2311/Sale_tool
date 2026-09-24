import React, { useEffect, useState, useCallback } from "react";
import { Button, Badge } from "@/components/ui";
import { X, FileAudio, RefreshCw, Play } from "lucide-react";
import { fetchAudioRecordsApi } from "../api/historyApi";
import type { AudioRecord } from "@/features/core";
import { cn } from "@/lib/utils";

interface HistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectRecord: (record: AudioRecord) => void;
}

export function HistoryDrawer({ isOpen, onClose, onSelectRecord }: HistoryDrawerProps) {
  const [records, setRecords] = useState<AudioRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState("");

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchAudioRecordsApi(0, 50);
      setRecords(data);
    } catch (err) {
      console.error("Lỗi khi tải lịch sử:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let ignore = false;

    fetchAudioRecordsApi(0, 50)
      .then((data) => {
        if (!ignore) setRecords(data);
      })
      .catch((err) => console.error("Lỗi khi tải lịch sử:", err));

    return () => {
      ignore = true;
    };
  }, [isOpen]);

  const filteredRecords = React.useMemo(() => {
    if (!search.trim()) return records;
    return records.filter(
      (r) =>
        r.filename.toLowerCase().includes(search.toLowerCase()) ||
        r.text.toLowerCase().includes(search.toLowerCase())
    );
  }, [records, search]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#0E0F14] border-l border-white/[0.08] h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-[#F3F4F6]">Lịch sử Cuộc gọi (PostgreSQL)</h2>
            <Badge variant="blue">{records.length}</Badge>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={loadRecords} disabled={isLoading} title="Làm mới">
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-white/[0.06]">
          <input
            type="text"
            placeholder="Tìm theo tên file hoặc nội dung..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#13141B] border border-white/[0.08] rounded-[8px] px-3 py-2 text-xs text-[#F3F4F6] placeholder-[#6B7280] focus:outline-none focus:border-[#266DF0]"
          />
        </div>

        {/* Record List */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {isLoading && records.length === 0 && (
            <div className="py-12 text-center text-xs text-[#9CA3AF]">Đang tải danh sách từ cơ sở dữ liệu...</div>
          )}

          {!isLoading && filteredRecords.length === 0 && (
            <div className="py-12 text-center text-xs text-[#6B7280]">Chưa có bản ghi âm nào được lưu.</div>
          )}

          {filteredRecords.map((rec) => (
            <div
              key={rec.id}
              className="p-4 rounded-[12px] bg-[#13141B] border border-white/[0.06] hover:border-white/[0.14] transition-all flex flex-col gap-2.5 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileAudio className="h-4 w-4 text-[#266DF0] shrink-0" />
                  <span className="text-xs font-semibold text-[#F3F4F6] truncate max-w-[200px]" title={rec.filename}>
                    {rec.filename}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#9CA3AF]">{rec.formatted_duration || `${rec.duration}s`}</span>
              </div>

              <p className="text-xs text-[#9CA3AF] line-clamp-2 leading-relaxed">{rec.text}</p>

              <div className="flex items-center justify-between pt-1 text-[11px] text-[#6B7280]">
                <span>{new Date(rec.created_at).toLocaleString("vi-VN")}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onSelectRecord(rec);
                    onClose();
                  }}
                  className="text-xs py-1 px-2.5 h-7"
                >
                  <Play className="h-3 w-3 fill-current text-[#266DF0]" />
                  <span>Tải vào Player</span>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
