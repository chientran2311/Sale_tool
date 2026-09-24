import { useState, useCallback } from "react";
import { Header } from "@/app/Header";
import { Sidebar } from "@/app/Sidebar";
import { AudioStudioCard } from "@/features/audio-studio";
import { useTranscription } from "@/features/transcription";
import { FullTranscriptCard, SegmentList } from "@/features/segments";
import { HistoryDrawer } from "@/features/history";
import { ReportStudio } from "@/features/reports";
import type { AudioRecord } from "@/features/core";
import { Sparkles, ArrowRight } from "lucide-react";

export default function App() {
  // Navigation State - Persist activeTab to localStorage, default to 'reports'
  const [activeTab, setActiveTab] = useState<"voice" | "reports">(() => {
    try {
      const saved = localStorage.getItem("sale_tool_active_tab");
      if (saved === "voice" || saved === "reports") return saved;
    } catch {}
    return "reports";
  });

  const handleTabChange = useCallback((tab: "voice" | "reports") => {
    setActiveTab(tab);
    try {
      localStorage.setItem("sale_tool_active_tab", tab);
    } catch {}
  }, []);

  // Input State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);

  // Options State
  const [enableDenoise, setEnableDenoise] = useState(true);
  const [modelType, setModelType] = useState<"phowhisper" | "zipformer">("zipformer");
  const [segmentEnable, setSegmentEnable] = useState(true);

  // Audio Playback & Seek State
  const [currentTime, setCurrentTime] = useState(0);
  const [seekTime, setSeekTime] = useState<number | null>(null);

  // History Drawer State
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Transcription Hook with multi-stage progress & real-time logs
  const {
    isTranscribing,
    progress,
    statusMessage,
    logs,
    elapsedTime,
    result,
    error,
    transcribe,
    setResult,
  } = useTranscription();

  // Giới hạn dung lượng tối đa 500MB
  const MAX_FILE_SIZE_BYTES = 500 * 1024 * 1024;

  // Handle File Upload
  const handleFileSelect = useCallback((file: File | null) => {
    setFileError(null);
    if (file && file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setFileError(`Dung lượng tệp (${sizeMb} MB) vượt quá giới hạn tối đa cho phép (500 MB). Vui lòng chọn tệp nhỏ hơn.`);
      setSelectedFile(null);
      setActiveAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    setSelectedFile(file);
    setActiveAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
  }, []);

  // Handle Audio from Live Mic Recorder
  const handleAudioFromRecorder = useCallback((blob: Blob, filename: string) => {
    setFileError(null);
    const file = new File([blob], filename, { type: blob.type || "audio/webm" });
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setFileError(`Dung lượng bản ghi (${sizeMb} MB) vượt quá giới hạn tối đa 500 MB.`);
      return;
    }
    setSelectedFile(file);
    setActiveAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });
  }, []);

  // Handle Reset / Clear Audio
  const handleClearAudio = useCallback(() => {
    setActiveAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setSelectedFile(null);
    setFileError(null);
  }, []);

  // Trigger Transcription
  const handleStartTranscribe = useCallback(async () => {
    if (!selectedFile) return;
    await transcribe(selectedFile, selectedFile.name, enableDenoise, segmentEnable, modelType);
  }, [selectedFile, enableDenoise, segmentEnable, modelType, transcribe]);

  // Handle Select from History Drawer
  const handleSelectRecordFromHistory = (rec: AudioRecord) => {
    setResult(rec);
  };

  // Click-to-Seek Handler from Segments
  const handleSeek = (seconds: number) => {
    setSeekTime(seconds);
    setTimeout(() => setSeekTime(null), 100);
  };

  return (
    <div className="flex min-h-screen bg-[#090A0D] text-[#F3F4F6]">
      {/* Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => {
          if (tab === "voice" || tab === "reports") {
            handleTabChange(tab);
          }
        }}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header onOpenHistory={() => setIsHistoryOpen(true)} />

        {/* Content Container */}
        <main className="flex-1 p-2.5 sm:p-4 md:p-6 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8 max-w-7xl w-full mx-auto">
          {activeTab === "reports" ? (
            <ReportStudio initialTranscriptText={result?.text || ""} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
              {/* Thông báo chuyển sang báo cáo khi đã có phiên âm */}
              {result?.text && (
                <div className="lg:col-span-12 p-3.5 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Sparkles className="h-5 w-5 text-blue-400 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-white">
                        Đã có bản phiên âm cuộc gọi! Bạn có muốn tạo Kế hoạch hoặc Báo cáo gửi Telegram không?
                      </p>
                      <p className="text-[11px] text-neutral-400">
                        Hệ thống sẽ tự động dùng Gemini AI chuẩn hóa theo cấu trúc 5 mục và xuất ảnh Dark Mode.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleTabChange("reports")}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-xl shadow-md shadow-blue-600/30 transition-all cursor-pointer shrink-0 w-full sm:w-auto justify-center"
                  >
                    <span>Mở Báo cáo AI</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {/* LEFT COLUMN: Unified Audio Studio (5 Cols) */}
              <div className="lg:col-span-5 flex flex-col gap-6">
                <AudioStudioCard
                  selectedFile={selectedFile}
                  activeAudioUrl={activeAudioUrl}
                  onFileSelect={handleFileSelect}
                  onAudioReady={handleAudioFromRecorder}
                  onClearAudio={handleClearAudio}
                  enableDenoise={enableDenoise}
                  onDenoiseChange={setEnableDenoise}
                  segmentEnable={segmentEnable}
                  onSegmentChange={setSegmentEnable}
                  modelType={modelType}
                  onModelTypeChange={setModelType}
                  onTranscribe={handleStartTranscribe}
                  isTranscribing={isTranscribing}
                  progress={progress}
                  statusMessage={statusMessage}
                  logs={logs}
                  elapsedTime={elapsedTime}
                  error={fileError || error}
                  onTimeUpdate={setCurrentTime}
                  seekTime={seekTime}
                />
              </div>

              {/* RIGHT COLUMN: Full Transcript & Segments (7 Cols) */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                {/* Full Transcript Card */}
                <FullTranscriptCard
                  text={result?.text || ""}
                  duration={result?.duration}
                  isDenoised={result?.denoise_enabled}
                />

                {/* Interactive Segments List with Click-to-Seek */}
                <SegmentList
                  segments={result?.segments}
                  currentTime={currentTime}
                  onSeek={handleSeek}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* History Slide-over Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onSelectRecord={handleSelectRecordFromHistory}
      />
    </div>
  );
}
