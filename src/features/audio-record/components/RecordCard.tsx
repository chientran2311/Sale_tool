import { Card, Button, Badge } from "@/components/ui";
import { Mic, Square, Trash2, CheckCircle2 } from "lucide-react";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { formatDuration } from "@/utils/formatDuration";

interface RecordCardProps {
  onAudioReady: (blob: Blob, filename: string) => void;
  disabled?: boolean;
}

export function RecordCard({ onAudioReady, disabled = false }: RecordCardProps) {
  const { isRecording, recordingTime, audioBlob, audioUrl, startRecording, stopRecording, clearRecording } =
    useAudioRecorder();

  const handleUseRecording = () => {
    if (audioBlob) {
      onAudioReady(audioBlob, `record_${Date.now()}.webm`);
    }
  };

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Mic className="h-4 w-4 text-[#266DF0]" />
          <h2 className="text-sm font-semibold text-[#F3F4F6]">Ghi âm Trực tiếp</h2>
        </div>
        {isRecording ? (
          <Badge variant="danger" withDot>
            Đang ghi âm
          </Badge>
        ) : audioBlob ? (
          <Badge variant="mint" withDot>
            Đã có file
          </Badge>
        ) : (
          <Badge variant="neutral">Micro Sẵn sàng</Badge>
        )}
      </div>

      <div className="flex flex-col items-center justify-center py-4 px-2 border border-white/[0.06] rounded-[10px] bg-[#0E0F14]/50">
        {/* Timer Display */}
        <div className="text-3xl font-mono font-semibold text-[#F3F4F6] tracking-tight mb-4">
          {formatDuration(recordingTime)}
        </div>

        {/* Action Button */}
        {!isRecording && !audioBlob && (
          <Button
            variant="primary"
            size="md"
            disabled={disabled}
            onClick={startRecording}
            className="rounded-full px-6 shadow-[0_0_20px_rgba(38,109,240,0.3)]"
          >
            <Mic className="h-4 w-4" />
            <span>Bắt đầu Ghi âm</span>
          </Button>
        )}

        {isRecording && (
          <Button
            variant="danger"
            size="md"
            onClick={stopRecording}
            className="rounded-full px-6 animate-pulse"
          >
            <Square className="h-4 w-4 fill-current" />
            <span>Dừng Ghi âm</span>
          </Button>
        )}

        {audioBlob && !isRecording && (
          <div className="flex flex-col items-center gap-3 w-full">
            {audioUrl && (
              <audio controls src={audioUrl} className="w-full h-8 max-w-xs rounded" />
            )}
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={handleUseRecording}>
                <CheckCircle2 className="h-4 w-4" />
                <span>Sử dụng file này</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={clearRecording}>
                <Trash2 className="h-4 w-4 text-red-400" />
                <span>Xóa</span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
