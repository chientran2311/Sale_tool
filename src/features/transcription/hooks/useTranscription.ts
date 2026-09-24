import { useState, useCallback, useRef, useEffect } from "react";
import type { AudioRecord } from "@/features/core";
import { transcribeAudioApi, getTranscribeProgressApi } from "../api/transcribeApi";

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: "info" | "process" | "success" | "warn";
}

export function useTranscription() {
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const [result, setResult] = useState<AudioRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLoggedMessageRef = useRef<string>("");
  const isFinishedRef = useRef<boolean>(false);

  const clearAllTimers = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => clearAllTimers();
  }, []);

  const addLog = useCallback(
    (message: string, type: "info" | "process" | "success" | "warn" = "info") => {
      const timestamp = new Date().toLocaleTimeString("vi-VN", { hour12: false });
      setLogs((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, timestamp, message, type },
      ]);
    },
    []
  );

  const transcribe = useCallback(
    async (
      file: File | Blob,
      fileName: string = "audio.wav",
      enableDenoise: boolean = true,
      segmentEnable: boolean = true,
      modelType: "phowhisper" | "zipformer" = "zipformer"
    ) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      clearAllTimers();
      isFinishedRef.current = false;
      lastLoggedMessageRef.current = "";

      const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const fileSizeMb = (file.size / (1024 * 1024)).toFixed(1);

      setIsTranscribing(true);
      setProgress(5);
      setLogs([]);
      setElapsedTime(0);
      setError(null);
      setStatusMessage("Đang chuẩn bị tệp và tải dữ liệu lên máy chủ...");

      // Đếm thời gian thực tế đã trôi qua
      elapsedTimerRef.current = setInterval(() => {
        setElapsedTime((t) => t + 1);
      }, 1000);

      addLog(`Bắt đầu tải tệp "${fileName}" (${fileSizeMb} MB) lên máy chủ...`, "info");
      addLog(`⚡ Mô hình lựa chọn: ${modelType === "zipformer" ? "Zipformer 30M INT8 siêu tốc" : "PhoWhisper-medium"}`, "info");

      let uploadDone = false;

      // Hàm bắt đầu polling tiến độ thật từ Backend theo taskId
      const startRealProgressPolling = () => {
        uploadDone = true;
        addLog("Tải tệp lên thành công 100%. Dữ liệu đã chuyển sang AI Pipeline.", "success");

        // Gọi polling định kỳ mỗi 1.5 giây
        pollIntervalRef.current = setInterval(async () => {
          if (isFinishedRef.current) return;
          try {
            const data = await getTranscribeProgressApi(taskId);
            if (isFinishedRef.current) return;

            if (data && data.status !== "not_found") {
              if (data.percent > 0) {
                setProgress((prev) => Math.max(prev, data.percent));
              }
              if (data.message) {
                setStatusMessage(data.message);
                if (data.message !== lastLoggedMessageRef.current) {
                  lastLoggedMessageRef.current = data.message;
                  const logType = data.stage === "completed" ? "success" : "process";
                  addLog(data.message, logType);
                }
              }

              // Nếu backend báo hoàn tất thông qua polling
              if (data.status === "completed" && data.result) {
                isFinishedRef.current = true;
                clearAllTimers();
                setProgress(100);
                setStatusMessage("Hoàn tất phiên âm!");
                setResult(data.result);
                setIsTranscribing(false);
                addLog("Hoàn tất nhận dạng thành công! Toàn bộ văn bản đã được ghi nhận.", "success");
              } else if (data.status === "failed") {
                isFinishedRef.current = true;
                clearAllTimers();
                const errMsg = data.error || data.message || "Lỗi xử lý phiên âm";
                setError(errMsg);
                setIsTranscribing(false);
                addLog(`❌ Thất bại: ${errMsg}`, "warn");
              }
            }
          } catch {
            // Không ngắt luồng nếu 1 lần poll gặp lỗi mạng chớp nhoáng
          }
        }, 1500);
      };

      try {
        const data = await transcribeAudioApi(
          file,
          fileName,
          enableDenoise,
          segmentEnable,
          modelType,
          taskId,
          (uploadPct) => {
            if (!uploadDone) {
              const mapped = Math.min(20, Math.round(5 + (uploadPct * 15) / 100));
              setProgress(mapped);
              if (uploadPct >= 100) {
                startRealProgressPolling();
              }
            }
          },
          abortControllerRef.current.signal
        );

        // Khi POST request trả về kết quả trực tiếp
        if (!isFinishedRef.current) {
          isFinishedRef.current = true;
          clearAllTimers();
          setProgress(100);
          setStatusMessage("Hoàn tất phiên âm!");
          const segCount = data.segments?.length || 0;
          addLog(
            segmentEnable
              ? `Hoàn tất nhận dạng thành công! Đã trích xuất ${segCount} phân đoạn câu thoại.`
              : "Hoàn tất nhận dạng thành công! Toàn bộ văn bản đã được ghi nhận.",
            "success"
          );
          setResult(data);
          return data;
        }
      } catch (err: any) {
        if (err.name === "CanceledError") {
          clearAllTimers();
          setIsTranscribing(false);
          return null;
        }

        // Kiểm tra xem backend đã hoàn tất hoặc đang xử lý qua polling chưa
        try {
          const pollData = await getTranscribeProgressApi(taskId);
          if (pollData && pollData.status === "completed" && pollData.result) {
            isFinishedRef.current = true;
            clearAllTimers();
            setProgress(100);
            setStatusMessage("Hoàn tất phiên âm!");
            setResult(pollData.result);
            setIsTranscribing(false);
            addLog("Kết nối đã khôi phục thành công! Đã tải bản ghi hoàn tất từ máy chủ.", "success");
            return pollData.result;
          }
          if (pollData && pollData.status === "processing") {
            // Backend vẫn đang chạy bình thường, tiếp tục để poller theo dõi
            addLog("Đang duy trì kết nối nền với máy chủ để nhận kết quả phân đoạn...", "info");
            return null;
          }
        } catch {
          // Bỏ qua lỗi phụ khi kiểm tra
        }

        clearAllTimers();
        const status = err.response?.status;
        const msg =
          err.response?.data?.detail ||
          err.response?.data?.message ||
          err.message ||
          "Lỗi khi xử lý phiên âm";
        const formattedMsg = status ? `[HTTP ${status}] ${msg}` : msg;
        setError(formattedMsg);
        setStatusMessage("");
        addLog(`❌ Lỗi xử lý: ${formattedMsg}`, "warn");
        console.error("Lỗi phiên âm chi tiết:", err);
        return null;
      } finally {
        if (isFinishedRef.current) {
          setIsTranscribing(false);
        }
      }
    },
    [addLog]
  );

  return {
    isTranscribing,
    progress,
    statusMessage,
    logs,
    elapsedTime,
    result,
    error,
    transcribe,
    setResult,
  };
}

