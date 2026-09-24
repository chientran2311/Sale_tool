import React, { useRef, useState } from "react";
import { Card, Button, Badge } from "@/components/ui";
import { UploadCloud, FileAudio, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AudioDropzoneProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

export function AudioDropzone({ selectedFile, onFileSelect, disabled = false }: AudioDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      onFileSelect(file);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[#F3F4F6]">Tải Tệp Âm thanh</h2>
        <span className="text-xs text-[#9CA3AF]">.wav, .mp3, .m4a, .webm</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        disabled={disabled}
        onChange={handleFileInput}
      />

      {!selectedFile ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && inputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-[10px] p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all",
            isDragOver
              ? "border-[#266DF0] bg-[#266DF0]/5"
              : "border-white/[0.1] hover:border-white/[0.2] bg-[#0E0F14]/30",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="h-10 w-10 rounded-full bg-white/[0.06] flex items-center justify-center text-[#266DF0]">
            <UploadCloud className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium text-[#F3F4F6]">Kéo thả file vào đây hoặc bấm để duyệt</p>
          <p className="text-xs text-[#9CA3AF]">Tối đa 100MB mỗi tệp</p>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3 rounded-[10px] bg-white/[0.04] border border-white/[0.08]">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-9 w-9 shrink-0 rounded-[8px] bg-[#266DF0]/10 border border-[#266DF0]/20 flex items-center justify-center text-[#266DF0]">
              <FileAudio className="h-5 w-5" />
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-[#F3F4F6] truncate max-w-[200px]" title={selectedFile.name}>
                {selectedFile.name}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="blue">{selectedFile.type || "audio"}</Badge>
                <span className="text-xs font-mono text-[#9CA3AF]">
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            onClick={() => onFileSelect(null)}
            className="h-8 w-8 hover:text-red-400"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}
