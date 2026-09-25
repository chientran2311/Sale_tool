import { useState, useEffect } from "react";
import {
  Sparkles,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Download,
  ClipboardPaste,
  Eye,
  Bot,
  ListPlus,
  PenLine,
  Plus,
  Trash2,
  RotateCcw,
  X,
  PlusCircle,
  Clock,
} from "lucide-react";
import {
  generateComboReportApi,
  sendReportApi,
  renderLiveImageApi,
  deleteMessageApi,
  type ReportMode,
} from "../api/reportApi";
import { cn } from "@/lib/utils";

interface TodoItem {
  id: string;
  title: string;
  note: string;
}

interface ScheduledItem {
  type: "report" | "plan";
  text: string;
  date: string;
  caption: string;
  imageUrl?: string;
  scheduledTimeStr: string; // e.g. "18:00" or "08:00"
}

interface StudioDraft {
  inputMethod: "ai_auto" | "manual_5";
  rawInput: string;
  // Báo cáo hôm nay
  todayReportDate: string;
  todayReportText: string;
  todayReportImg: string;
  todayReportCaption: string;
  // Kế hoạch ngày mai
  tomorrowPlanDate: string;
  tomorrowPlanText: string;
  tomorrowPlanImg: string;
  tomorrowPlanCaption: string;
  // Viết tay thủ công
  manualMode: ReportMode;
  manualSections: {
    chotDon: string;
    gapMat: string;
    guiMau: string;
    lienHe: string;
    sec5: string;
  };
  manualExtraTodos: TodoItem[];
  manualFinalText: string;
  manualPreviewImg: string;
  testBypassTime?: boolean;
}

const DRAFT_STORAGE_KEY = "sale_tool_report_draft_v3";
const SCHEDULE_STORAGE_KEY = "sale_tool_scheduled_queue_v1";

const getTodayLocalDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTomorrowLocalDateStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getNextDayStr = (dateStr: string) => {
  try {
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3) {
      const [y, m, d] = parts;
      const date = new Date(y, m - 1, d);
      date.setDate(date.getDate() + 1);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  } catch {}
  return dateStr;
};

const formatCaption = (m: "plan" | "report", dateStr: string) => {
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const [, month, day] = parts;
      const label = m === "plan" ? "Kế hoạch" : "Báo cáo";
      return `${label} ${day}/${month}`;
    }
  } catch {}
  return m === "plan" ? "Kế hoạch" : "Báo cáo";
};

const loadSavedDraft = (): Partial<StudioDraft> | null => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

interface ReportStudioProps {
  initialTranscriptText?: string;
}

export function ReportStudio({ initialTranscriptText = "" }: ReportStudioProps) {
  const initialDraft = loadSavedDraft();

  // 1. Phương thức nhập: "ai_auto" (AI Combo Báo cáo & Kế hoạch) vs "manual_5" (Tự viết tay thủ công)
  const [inputMethod, setInputMethod] = useState<"ai_auto" | "manual_5">(
    () => initialDraft?.inputMethod || "ai_auto"
  );

  // Input thô cho AI (biên bản cuộc gặp, ghi âm, notes...)
  const [rawInput, setRawInput] = useState<string>(
    () => initialDraft?.rawInput ?? initialTranscriptText
  );

  // Báo cáo hôm nay
  const [todayReportDate, setTodayReportDate] = useState<string>(
    () => initialDraft?.todayReportDate || getTodayLocalDateStr()
  );
  const [todayReportText, setTodayReportText] = useState<string>(
    () => initialDraft?.todayReportText || ""
  );
  const [todayReportImg, setTodayReportImg] = useState<string>(
    () => initialDraft?.todayReportImg || ""
  );
  const todayReportCaption = formatCaption("report", todayReportDate);

  // Kế hoạch ngày mai
  const [tomorrowPlanDate, setTomorrowPlanDate] = useState<string>(
    () => initialDraft?.tomorrowPlanDate || getTomorrowLocalDateStr()
  );
  const [tomorrowPlanText, setTomorrowPlanText] = useState<string>(
    () => initialDraft?.tomorrowPlanText || ""
  );
  const [tomorrowPlanImg, setTomorrowPlanImg] = useState<string>(
    () => initialDraft?.tomorrowPlanImg || ""
  );
  const tomorrowPlanCaption = formatCaption("plan", tomorrowPlanDate);

  // Viết tay thủ công (Manual Mode)
  const [manualMode, setManualMode] = useState<ReportMode>(
    () => initialDraft?.manualMode || "report"
  );
  const [manualSections, setManualSections] = useState(
    () =>
      initialDraft?.manualSections || {
        chotDon: "",
        gapMat: "",
        guiMau: "",
        lienHe: "",
        sec5: "",
      }
  );
  const [manualExtraTodos, setManualExtraTodos] = useState<TodoItem[]>(
    () => initialDraft?.manualExtraTodos || []
  );
  const [manualFinalText, setManualFinalText] = useState<string>(
    () => initialDraft?.manualFinalText || ""
  );
  const [manualPreviewImg, setManualPreviewImg] = useState<string>(
    () => initialDraft?.manualPreviewImg || ""
  );

  // Loading States
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isRenderingManual, setIsRenderingManual] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isSendingPlan, setIsSendingPlan] = useState(false);

  // Status Message & Copy feedback
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error" | "warning";
    text: string;
  } | null>(null);
  const [copiedType, setCopiedType] = useState<"report" | "plan" | "manual" | null>(null);

  // Tin nhắn vừa gửi sang Telegram (để có thể xóa ngay nếu gửi nhầm)
  const [lastSentMessage, setLastSentMessage] = useState<{
    messageId: number;
    chatId: string;
    caption: string;
  } | null>(() => {
    try {
      const saved = localStorage.getItem("sale_tool_last_sent_msg");
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [isDeletingMsg, setIsDeletingMsg] = useState(false);

  // Hàng đợi hẹn giờ gửi (Scheduled Queue)
  const [scheduledItems, setScheduledItems] = useState<ScheduledItem[]>(() => {
    try {
      const saved = localStorage.getItem(SCHEDULE_STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  const isReportScheduled = scheduledItems.some(
    (s) => s.type === "report" && s.date === todayReportDate
  );
  const isPlanScheduled = scheduledItems.some(
    (s) => s.type === "plan" && s.date === tomorrowPlanDate
  );

  // Đồng hồ kiểm tra thời gian thực
  const [currentTimeStr, setCurrentTimeStr] = useState<string>(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const d = new Date();
      setCurrentTimeStr(
        `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
      );
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Tính toán khung giờ chuẩn
  // Báo cáo: 18h00 - 20h00 tối
  // Kế hoạch: 08h00 - 08h25 sáng
  const checkTimeStatus = () => {
    const d = new Date();
    const currentMins = d.getHours() * 60 + d.getMinutes();

    const isReportValid = currentMins >= 18 * 60 && currentMins <= 20 * 60;
    const isReportEarly = currentMins < 18 * 60;
    const isReportLate = currentMins > 20 * 60;
    const reportWindowLabel = "18h00 - 20h00 tối";

    const isPlanValid = currentMins >= 8 * 60 && currentMins <= 8 * 60 + 25;
    const isPlanEarly = currentMins < 8 * 60;
    const isPlanLate = currentMins > 8 * 60 + 25;
    const planWindowLabel = "08h00 - 08h25 sáng";

    return {
      isReportValid,
      isReportEarly,
      isReportLate,
      reportWindowLabel,
      isPlanValid,
      isPlanEarly,
      isPlanLate,
      planWindowLabel,
    };
  };

  const timeStatus = checkTimeStatus();

  // Kiểm tra ngày thực tế hôm nay và ngày mai so với ngày người dùng đang chọn
  const actualTodayStr = getTodayLocalDateStr();
  const actualTomorrowStr = getTomorrowLocalDateStr();
  const isReportForToday = todayReportDate === actualTodayStr;
  const isPlanForTomorrow = tomorrowPlanDate === actualTomorrowStr;

  // Xử lý đổi ngày Báo cáo -> Tự động tính ngày Kế hoạch kế tiếp (+1 ngày)
  const handleTodayDateChange = (newDate: string) => {
    setTodayReportDate(newDate);
    const nextDay = getNextDayStr(newDate);
    setTomorrowPlanDate(nextDay);
  };

  // Tự động lưu bản nháp vào localStorage
  useEffect(() => {
    const draft: StudioDraft = {
      inputMethod,
      rawInput,
      todayReportDate,
      todayReportText,
      todayReportImg,
      todayReportCaption,
      tomorrowPlanDate,
      tomorrowPlanText,
      tomorrowPlanImg,
      tomorrowPlanCaption,
      manualMode,
      manualSections,
      manualExtraTodos,
      manualFinalText,
      manualPreviewImg,
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            ...draft,
            todayReportImg: "",
            tomorrowPlanImg: "",
            manualPreviewImg: "",
          })
        );
      } catch {}
    }
  }, [
    inputMethod,
    rawInput,
    todayReportDate,
    todayReportText,
    todayReportImg,
    todayReportCaption,
    tomorrowPlanDate,
    tomorrowPlanText,
    tomorrowPlanImg,
    tomorrowPlanCaption,
    manualMode,
    manualSections,
    manualExtraTodos,
    manualFinalText,
    manualPreviewImg,
  ]);

  // Lưu scheduled items
  useEffect(() => {
    try {
      localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(scheduledItems));
    } catch {}
  }, [scheduledItems]);

  // Bộ hẹn giờ tự động gửi nền khi đến khung giờ chuẩn
  useEffect(() => {
    const checkAndAutoSend = async () => {
      if (scheduledItems.length === 0) return;
      const { isReportValid, isPlanValid } = checkTimeStatus();
      const curToday = getTodayLocalDateStr();

      const remaining: ScheduledItem[] = [];

      for (const item of scheduledItems) {
        if (item.type === "report" && isReportValid && item.date === curToday) {
          try {
            await sendReportApi({
              mode: "report",
              report_date: item.date,
              summary_text: item.text,
              image_data_url: item.imageUrl,
            });
            setStatusMessage({
              type: "success",
              text: `⏰ [Tự động gửi] Đã gửi ${item.caption} vào nhóm Telegram thành công (Khung giờ 18:00 - 20:00)!`,
            });
          } catch {
            remaining.push(item);
          }
        } else if (item.type === "plan" && isPlanValid && item.date === curToday) {
          try {
            await sendReportApi({
              mode: "plan",
              report_date: item.date,
              summary_text: item.text,
              image_data_url: item.imageUrl,
            });
            setStatusMessage({
              type: "success",
              text: `⏰ [Tự động gửi] Đã gửi ${item.caption} vào nhóm Telegram thành công (Khung giờ 08:00 - 08:25)!`,
            });
          } catch {
            remaining.push(item);
          }
        } else {
          remaining.push(item);
        }
      }

      if (remaining.length !== scheduledItems.length) {
        setScheduledItems(remaining);
      }
    };

    const interval = setInterval(checkAndAutoSend, 30000); // kiểm tra mỗi 30s
    return () => clearInterval(interval);
  }, [scheduledItems]);

  // Tự động debounced update ảnh Báo cáo khi sửa text
  useEffect(() => {
    if (!todayReportText.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const res = await renderLiveImageApi({
          content: todayReportText.trim(),
          title: todayReportCaption,
        });
        setTodayReportImg(res.image_data_url);
      } catch (e) {
        console.error("Lỗi cập nhật ảnh Báo cáo:", e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [todayReportText, todayReportCaption]);

  // Tự động debounced update ảnh Kế hoạch khi sửa text
  useEffect(() => {
    if (!tomorrowPlanText.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const res = await renderLiveImageApi({
          content: tomorrowPlanText.trim(),
          title: tomorrowPlanCaption,
        });
        setTomorrowPlanImg(res.image_data_url);
      } catch (e) {
        console.error("Lỗi cập nhật ảnh Kế hoạch:", e);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [tomorrowPlanText, tomorrowPlanCaption]);

  // Hành động: "Tạo Báo cáo & Kế hoạch bằng AI" (Sinh đồng thời cả 2)
  const handleGenerateCombo = async () => {
    if (!rawInput.trim()) {
      setStatusMessage({
        type: "error",
        text: "Vui lòng nhập nội dung ghi chép hoặc dán từ bản ghi âm!",
      });
      return;
    }

    setIsGeneratingAi(true);
    setStatusMessage(null);

    try {
      const res = await generateComboReportApi({
        report_date: todayReportDate,
        content: rawInput.trim(),
      });

      // Gán Báo cáo hôm nay
      setTodayReportText(res.report.summary_text);
      setTodayReportImg(res.report.image_data_url);
      setTodayReportDate(res.report.report_date);

      // Gán Kế hoạch ngày mai
      setTomorrowPlanText(res.plan.summary_text);
      setTomorrowPlanImg(res.plan.image_data_url);
      setTomorrowPlanDate(res.plan.report_date);

      setStatusMessage({
        type: "success",
        text: "✨ AI đã sinh thành công Báo cáo hôm nay (5 mục) và Kế hoạch ngày mai! Bạn có thể chỉnh sửa trực tiếp bên dưới.",
      });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail || err?.message || "Lỗi khi gọi AI sinh Báo cáo & Kế hoạch";
      setStatusMessage({ type: "error", text: String(errorMsg) });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Hành động: Gửi Báo cáo sang Telegram
  const handleSendReport = async () => {
    if (!todayReportText.trim()) {
      setStatusMessage({
        type: "error",
        text: "Chưa có nội dung Báo cáo hôm nay! Vui lòng nhập nội dung trước khi gửi.",
      });
      return;
    }

    // 1. Kiểm tra ngày:
    // Nếu là Báo cáo của ngày hôm nay -> Kiểm tra khung giờ 18:00 - 20:00
    if (isReportForToday) {
      const { isReportEarly, isReportLate, reportWindowLabel } = checkTimeStatus();
      if (isReportEarly) {
        // Tự động lưu lịch hẹn nếu chưa có
        const exists = scheduledItems.some((s) => s.type === "report" && s.date === todayReportDate);
        if (!exists) {
          const newItem: ScheduledItem = {
            type: "report",
            text: todayReportText,
            date: todayReportDate,
            caption: todayReportCaption,
            imageUrl: todayReportImg || undefined,
            scheduledTimeStr: reportWindowLabel,
          };
          setScheduledItems((prev) => [...prev, newItem]);
        }
        const confirmEarly = window.confirm(
          `⏰ Hiện tại (${currentTimeStr}) chưa tới khung giờ gửi Báo cáo chuẩn (${reportWindowLabel})!\n\nHệ thống đã lưu lịch hẹn tự động gửi lúc 18:00 hôm nay.\nBạn có muốn gửi ngay lập tức không? (Bấm OK để gửi ngay, Cancel để giữ lịch hẹn tự động)`
        );
        if (!confirmEarly) {
          setStatusMessage({
            type: "warning",
            text: `⏰ Báo cáo đã được lưu lịch hẹn tự động gửi vào lúc 18:00 hôm nay (khung giờ 18:00 - 20:00 tối)!`,
          });
          return;
        }
      } else if (isReportLate) {
        const confirmLate = window.confirm(
          `⚠️ Hiện tại (${currentTimeStr}) đã quá khung giờ gửi Báo cáo chuẩn (${reportWindowLabel})!\nBạn có chắc chắn vẫn muốn gửi trễ ngay bây giờ không?`
        );
        if (!confirmLate) return;
      }
    } else {
      // Nếu Báo cáo của ngày khác hôm nay (bổ sung báo cáo cũ...): Cho phép gửi trực tiếp ngay
      const confirmDiff = window.confirm(
        `ℹ️ Bạn đang gửi Báo cáo cho ngày ${todayReportDate} (khác ngày hôm nay: ${actualTodayStr}).\nBạn có muốn gửi trực tiếp ngay bây giờ không?`
      );
      if (!confirmDiff) return;
    }

    // Gửi ngay!
    setIsSendingReport(true);
    setStatusMessage(null);

    try {
      const res = await sendReportApi({
        mode: "report",
        report_date: todayReportDate,
        summary_text: todayReportText,
        image_data_url: todayReportImg || undefined,
      });

      if (res.message_id) {
        const sentData = {
          messageId: res.message_id,
          chatId: res.chat_id,
          caption: res.caption || todayReportCaption,
        };
        setLastSentMessage(sentData);
        localStorage.setItem("sale_tool_last_sent_msg", JSON.stringify(sentData));
      }

      // Xóa khỏi hàng đợi nếu có
      setScheduledItems((prev) => prev.filter((s) => !(s.type === "report" && s.date === todayReportDate)));

      setStatusMessage({
        type: "success",
        text: `🚀 Đã gửi Báo cáo thành công vào Telegram kèm tiêu đề: "${res.caption}"!`,
      });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail || err?.message || "Lỗi khi gửi Báo cáo sang Telegram";
      setStatusMessage({ type: "error", text: String(errorMsg) });
    } finally {
      setIsSendingReport(false);
    }
  };

  // Hành động: Gửi Kế hoạch sang Telegram
  const handleSendPlan = async () => {
    if (!tomorrowPlanText.trim()) {
      setStatusMessage({
        type: "error",
        text: "Chưa có nội dung Kế hoạch ngày mai! Vui lòng nhập nội dung trước khi gửi.",
      });
      return;
    }

    if (isPlanForTomorrow) {
      // Kế hoạch cho ngày mai: Nếu bấm gửi khi chưa tới 8h sáng mai -> Hỏi chuyển sang hẹn giờ
      const confirmSchedule = window.confirm(
        `⏰ Kế hoạch chuẩn nên được gửi vào lúc 08:00 - 08:25 sáng mai (${tomorrowPlanDate})!\n\nBạn có muốn lưu lịch hẹn tự động gửi lúc 08:00 sáng mai không?\n(Bấm OK để hẹn giờ sáng mai, Cancel để gửi đi ngay bây giờ)`
      );
      if (confirmSchedule) {
        handleSchedulePlanNow();
        return;
      }
    } else if (tomorrowPlanDate === actualTodayStr) {
      // Kế hoạch cho chính ngày hôm nay
      const { isPlanEarly, isPlanLate } = checkTimeStatus();
      if (isPlanEarly) {
        handleSchedulePlanNow();
        return;
      } else if (isPlanLate) {
        const confirmLate = window.confirm(
          `⚠️ Hiện tại (${currentTimeStr}) đã quá khung giờ gửi Kế hoạch chuẩn (08:00 - 08:25 sáng)!\nBạn có chắc chắn muốn gửi ngay bây giờ không?`
        );
        if (!confirmLate) return;
      }
    } else {
      // Kế hoạch ngày khác: Gửi trực tiếp
      const confirmDiff = window.confirm(
        `ℹ️ Bạn đang gửi Kế hoạch cho ngày ${tomorrowPlanDate} (khác ngày mai: ${actualTomorrowStr}).\nBạn có muốn gửi trực tiếp ngay bây giờ không?`
      );
      if (!confirmDiff) return;
    }

    // Gửi ngay!
    setIsSendingPlan(true);
    setStatusMessage(null);

    try {
      const res = await sendReportApi({
        mode: "plan",
        report_date: tomorrowPlanDate,
        summary_text: tomorrowPlanText,
        image_data_url: tomorrowPlanImg || undefined,
      });

      if (res.message_id) {
        const sentData = {
          messageId: res.message_id,
          chatId: res.chat_id,
          caption: res.caption || tomorrowPlanCaption,
        };
        setLastSentMessage(sentData);
        localStorage.setItem("sale_tool_last_sent_msg", JSON.stringify(sentData));
      }

      setScheduledItems((prev) => prev.filter((s) => !(s.type === "plan" && s.date === tomorrowPlanDate)));

      setStatusMessage({
        type: "success",
        text: `🚀 Đã gửi Kế hoạch thành công vào Telegram kèm tiêu đề: "${res.caption}"!`,
      });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail || err?.message || "Lỗi khi gửi Kế hoạch sang Telegram";
      setStatusMessage({ type: "error", text: String(errorMsg) });
    } finally {
      setIsSendingPlan(false);
    }
  };

  // Nút chủ động cập nhật lại ảnh Báo cáo theo văn bản hiện tại
  const [isUpdatingReportImg, setIsUpdatingReportImg] = useState(false);
  const handleUpdateReportImageNow = async () => {
    if (!todayReportText.trim()) return;
    setIsUpdatingReportImg(true);
    try {
      const res = await renderLiveImageApi({
        content: todayReportText.trim(),
        title: todayReportCaption,
      });
      setTodayReportImg(res.image_data_url);
      setStatusMessage({
        type: "success",
        text: `Đã cập nhật lại ảnh thẻ Báo cáo (${todayReportCaption}) theo nội dung mới nhất!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.response?.data?.detail || "Lỗi khi cập nhật ảnh Báo cáo",
      });
    } finally {
      setIsUpdatingReportImg(false);
    }
  };

  // Nút chủ động cập nhật lại ảnh Kế hoạch theo văn bản hiện tại
  const [isUpdatingPlanImg, setIsUpdatingPlanImg] = useState(false);
  const handleUpdatePlanImageNow = async () => {
    if (!tomorrowPlanText.trim()) return;
    setIsUpdatingPlanImg(true);
    try {
      const res = await renderLiveImageApi({
        content: tomorrowPlanText.trim(),
        title: tomorrowPlanCaption,
      });
      setTomorrowPlanImg(res.image_data_url);
      setStatusMessage({
        type: "success",
        text: `Đã cập nhật lại ảnh thẻ Kế hoạch (${tomorrowPlanCaption}) theo nội dung mới nhất!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.response?.data?.detail || "Lỗi khi cập nhật ảnh Kế hoạch",
      });
    } finally {
      setIsUpdatingPlanImg(false);
    }
  };

  // Nút chủ động đặt lịch hẹn gửi Kế hoạch lúc 08:00 sáng mai
  const handleSchedulePlanNow = async () => {
    if (!tomorrowPlanText.trim()) {
      setStatusMessage({
        type: "error",
        text: "Chưa có nội dung Kế hoạch ngày mai! Vui lòng nhập nội dung trước khi hẹn giờ.",
      });
      return;
    }
    const actualToday = getTodayLocalDateStr();
    const actualTomorrow = getTomorrowLocalDateStr();

    // 1. Kiểm tra ngày chọn input vs time.now() & ngày mai
    if (tomorrowPlanDate !== actualToday && tomorrowPlanDate !== actualTomorrow) {
      setStatusMessage({
        type: "error",
        text: `⚠️ Ngày chọn Kế hoạch (${tomorrowPlanDate}) không phải ngày hôm nay (${actualToday}) hoặc ngày mai (${actualTomorrow}). Không thể dùng nút hẹn gửi! Vui lòng bấm "Gửi ngay" để gửi trực tiếp.`,
      });
      return;
    }

    const d = new Date();
    const currentMins = d.getHours() * 60 + d.getMinutes();
    const startMins = 8 * 60;        // 08h00
    const endMins = 8 * 60 + 25;     // 08h25

    // Nếu chọn Kế hoạch cho chính ngày hôm nay
    if (tomorrowPlanDate === actualToday) {
      if (currentMins > endMins) {
        // Đã quá 08h25
        setStatusMessage({
          type: "error",
          text: `⛔ Đã quá khung giờ gửi Kế hoạch hôm nay (sau 08:25 sáng)! Không thể hẹn gửi tự động nữa. Vui lòng bấm "Gửi ngay" nếu bạn vẫn muốn gửi trễ trực tiếp.`,
        });
        return;
      }

      if (currentMins < startMins) {
        // Sớm hơn 08h00 -> Cứ lên lịch hẹn tự động gửi lúc 08h00
        const newItem: ScheduledItem = {
          type: "plan",
          text: tomorrowPlanText,
          date: tomorrowPlanDate,
          caption: tomorrowPlanCaption,
          imageUrl: tomorrowPlanImg || undefined,
          scheduledTimeStr: "08:00 - 08:25 sáng",
        };
        setScheduledItems((prev) => [
          ...prev.filter((s) => !(s.type === "plan" && s.date === tomorrowPlanDate)),
          newItem,
        ]);
        setStatusMessage({
          type: "success",
          text: `⏰ Đã lên lịch hẹn tự động gửi Kế hoạch (${tomorrowPlanCaption})! Hệ thống sẽ tự động gửi vào nhóm Telegram vào lúc 08:00 sáng hôm nay (khung giờ 08:00 - 08:25).`,
        });
        return;
      }

      // Nằm trong khoảng 08h00 - 08h25 -> Enable và thực hiện gửi
      const newItem: ScheduledItem = {
        type: "plan",
        text: tomorrowPlanText,
        date: tomorrowPlanDate,
        caption: tomorrowPlanCaption,
        imageUrl: tomorrowPlanImg || undefined,
        scheduledTimeStr: "08:00 - 08:25 sáng",
      };
      setScheduledItems((prev) => [
        ...prev.filter((s) => !(s.type === "plan" && s.date === tomorrowPlanDate)),
        newItem,
      ]);

      setIsSendingPlan(true);
      try {
        const res = await sendReportApi({
          mode: "plan",
          report_date: tomorrowPlanDate,
          summary_text: tomorrowPlanText,
          image_data_url: tomorrowPlanImg || undefined,
        });

        if (res.message_id) {
          const sentData = {
            messageId: res.message_id,
            chatId: res.chat_id,
            caption: res.caption || tomorrowPlanCaption,
          };
          setLastSentMessage(sentData);
          localStorage.setItem("sale_tool_last_sent_msg", JSON.stringify(sentData));
        }

        setScheduledItems((prev) => prev.filter((s) => !(s.type === "plan" && s.date === tomorrowPlanDate)));

        setStatusMessage({
          type: "success",
          text: `🚀 Đang trong khung giờ chuẩn (08:00 - 08:25). Đã thực hiện gửi Kế hoạch (${tomorrowPlanCaption}) vào Telegram thành công!`,
        });
      } catch (err: any) {
        setStatusMessage({
          type: "error",
          text: err?.response?.data?.detail || err?.message || "Lỗi khi gửi Kế hoạch sang Telegram",
        });
      } finally {
        setIsSendingPlan(false);
      }
      return;
    }

    // Nếu chọn Kế hoạch cho ngày mai (tomorrowPlanDate === actualTomorrow)
    // Sớm hơn 8h sáng mai -> Cứ lên lịch hẹn tự động gửi lúc 08h00 sáng mai
    const newItem: ScheduledItem = {
      type: "plan",
      text: tomorrowPlanText,
      date: tomorrowPlanDate,
      caption: tomorrowPlanCaption,
      imageUrl: tomorrowPlanImg || undefined,
      scheduledTimeStr: "08:00 - 08:25 sáng mai",
    };
    setScheduledItems((prev) => [
      ...prev.filter((s) => !(s.type === "plan" && s.date === tomorrowPlanDate)),
      newItem,
    ]);
    setStatusMessage({
      type: "success",
      text: `⏰ Đã lên lịch hẹn tự động gửi Kế hoạch ngày mai (${tomorrowPlanCaption})! Hệ thống sẽ tự động gửi vào nhóm Telegram vào lúc 08:00 sáng mai (khung giờ 08:00 - 08:25).`,
    });
  };

  const handleCancelPlanSchedule = () => {
    setScheduledItems((prev) =>
      prev.filter((s) => !(s.type === "plan" && s.date === tomorrowPlanDate))
    );
    setStatusMessage({
      type: "success",
      text: `Đã hủy lịch hẹn gửi Kế hoạch (${tomorrowPlanCaption}).`,
    });
  };

  // Nút chủ động đặt lịch hẹn gửi Báo cáo
  const handleScheduleReportNow = async () => {
    if (!todayReportText.trim()) {
      setStatusMessage({
        type: "error",
        text: "Chưa có nội dung Báo cáo hôm nay! Vui lòng nhập nội dung trước khi hẹn giờ.",
      });
      return;
    }

    const actualToday = getTodayLocalDateStr();

    // 1. Kiểm tra ngày chọn input vs time.now()
    if (todayReportDate !== actualToday) {
      setStatusMessage({
        type: "error",
        text: `⚠️ Ngày chọn Báo cáo (${todayReportDate}) khác với ngày hôm nay (${actualToday}). Không thể dùng nút hẹn gửi! Vui lòng bấm "Gửi ngay" để gửi trực tiếp.`,
      });
      return;
    }

    // 2. Ngày chọn == ngày time.now() -> So sánh khung giờ
    const d = new Date();
    const currentMins = d.getHours() * 60 + d.getMinutes();
    const startMins = 18 * 60; // 18h00
    const endMins = 20 * 60;   // 20h00

    if (currentMins > endMins) {
      // Đã quá 20h
      setStatusMessage({
        type: "error",
        text: `⛔ Đã quá khung giờ gửi Báo cáo hôm nay (sau 20:00 tối)! Không thể hẹn gửi tự động nữa. Vui lòng bấm "Gửi ngay" nếu bạn vẫn muốn gửi trễ trực tiếp.`,
      });
      return;
    }

    if (currentMins < startMins) {
      // Sớm hơn 18h -> Cứ lên lịch hẹn tự động gửi
      const newItem: ScheduledItem = {
        type: "report",
        text: todayReportText,
        date: todayReportDate,
        caption: todayReportCaption,
        imageUrl: todayReportImg || undefined,
        scheduledTimeStr: "18:00 - 20:00 tối",
      };
      setScheduledItems((prev) => [
        ...prev.filter((s) => !(s.type === "report" && s.date === todayReportDate)),
        newItem,
      ]);
      setStatusMessage({
        type: "success",
        text: `⏰ Đã lên lịch hẹn tự động gửi Báo cáo (${todayReportCaption})! Hệ thống sẽ tự động gửi vào nhóm Telegram vào lúc 18:00 hôm nay (khung giờ 18:00 - 20:00).`,
      });
      return;
    }

    // Nằm trong khoảng 18h - 20h -> Enable và thực hiện hẹn giờ gửi
    const newItem: ScheduledItem = {
      type: "report",
      text: todayReportText,
      date: todayReportDate,
      caption: todayReportCaption,
      imageUrl: todayReportImg || undefined,
      scheduledTimeStr: "18:00 - 20:00 tối",
    };
    setScheduledItems((prev) => [
      ...prev.filter((s) => !(s.type === "report" && s.date === todayReportDate)),
      newItem,
    ]);

    // Vì đang trong khung giờ 18h - 20h, thực hiện gửi ngay cho người dùng
    setIsSendingReport(true);
    try {
      const res = await sendReportApi({
        mode: "report",
        report_date: todayReportDate,
        summary_text: todayReportText,
        image_data_url: todayReportImg || undefined,
      });

      if (res.message_id) {
        const sentData = {
          messageId: res.message_id,
          chatId: res.chat_id,
          caption: res.caption || todayReportCaption,
        };
        setLastSentMessage(sentData);
        localStorage.setItem("sale_tool_last_sent_msg", JSON.stringify(sentData));
      }

      setScheduledItems((prev) => prev.filter((s) => !(s.type === "report" && s.date === todayReportDate)));

      setStatusMessage({
        type: "success",
        text: `🚀 Đang trong khung giờ chuẩn (18:00 - 20:00). Đã thực hiện gửi Báo cáo (${todayReportCaption}) vào Telegram thành công!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.response?.data?.detail || err?.message || "Lỗi khi gửi Báo cáo sang Telegram",
      });
    } finally {
      setIsSendingReport(false);
    }
  };

  const handleCancelReportSchedule = () => {
    setScheduledItems((prev) =>
      prev.filter((s) => !(s.type === "report" && s.date === todayReportDate))
    );
    setStatusMessage({
      type: "success",
      text: `Đã hủy lịch hẹn gửi Báo cáo (${todayReportCaption}).`,
    });
  };

  // Nút chủ động cập nhật lại ảnh cho chế độ viết tay
  const [isUpdatingManualImg, setIsUpdatingManualImg] = useState(false);
  const handleUpdateManualImageNow = async () => {
    if (!manualFinalText.trim()) return;
    setIsUpdatingManualImg(true);
    try {
      const targetDate = manualMode === "plan" ? tomorrowPlanDate : todayReportDate;
      const caption = formatCaption(manualMode, targetDate);
      const res = await renderLiveImageApi({
        content: manualFinalText.trim(),
        title: caption,
      });
      setManualPreviewImg(res.image_data_url);
      if (manualMode === "report") {
        setTodayReportText(manualFinalText.trim());
        setTodayReportImg(res.image_data_url);
      } else {
        setTomorrowPlanText(manualFinalText.trim());
        setTomorrowPlanImg(res.image_data_url);
      }
      setStatusMessage({
        type: "success",
        text: `Đã cập nhật lại ảnh ${caption} từ văn bản viết tay!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.response?.data?.detail || "Lỗi khi cập nhật ảnh viết tay",
      });
    } finally {
      setIsUpdatingManualImg(false);
    }
  };

  // Modal Thêm mục công việc mới (mục 6, 7...) vào Kế hoạch (TÁI SỬ DỤNG MODULE HIỆN CÓ)
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [modalTodoTitle, setModalTodoTitle] = useState("");
  const [modalTodoNote, setModalTodoNote] = useState("");
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  const getSectionNumbersFromText = (text: string): number[] => {
    const matches = (text || "").match(/^(\d+)[\.\:]/gm) || [];
    return matches.map((m) => parseInt(m.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
  };

  const getNextSectionNumber = (): number => {
    const nums = getSectionNumbersFromText(tomorrowPlanText);
    if (nums.length === 0) return 6;
    return Math.max(...nums) + 1;
  };

  const nextSectionNum = getNextSectionNumber();

  const handleOpenAddSectionModal = () => {
    setModalTodoTitle("");
    setModalTodoNote("");
    setIsAddSectionModalOpen(true);
  };

  const handleConfirmAddSection = async () => {
    if (!modalTodoTitle.trim() && !modalTodoNote.trim()) {
      setStatusMessage({
        type: "error",
        text: "Vui lòng nhập ít nhất tiêu đề hoặc nội dung chi tiết công việc!",
      });
      return;
    }

    setIsSubmittingModal(true);
    setStatusMessage(null);

    try {
      const nextNum = getNextSectionNumber();
      const title = modalTodoTitle.trim() || `Công việc #${nextNum}`;

      const rawLines = modalTodoNote
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      let bulletContent = "";
      if (rawLines.length > 0) {
        bulletContent = rawLines
          .map((l) => `• ${l.replace(/^[\-\•\*\+\>\–\—\d+\.]\s*/, "")}`)
          .join("\n");
      } else {
        bulletContent = `• ${title}`;
      }

      const newSectionBlock = `\n\n${nextNum}. ${title}\n${bulletContent}`;
      const updatedText = (
        tomorrowPlanText.trim()
          ? tomorrowPlanText.trim() + newSectionBlock
          : `${tomorrowPlanCaption}\n\n${nextNum}. ${title}\n${bulletContent}`
      ).trim();

      setTomorrowPlanText(updatedText);

      // Render lại ảnh kế hoạch ngay lập tức
      const imgRes = await renderLiveImageApi({
        content: updatedText,
        title: tomorrowPlanCaption,
      });

      setTomorrowPlanImg(imgRes.image_data_url);
      setIsAddSectionModalOpen(false);
      setModalTodoTitle("");
      setModalTodoNote("");

      setStatusMessage({
        type: "success",
        text: `Đã thêm mục #${nextNum} ("${title}") vào Kế hoạch và cập nhật ảnh thẻ!`,
      });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail || err?.message || "Lỗi khi cập nhật ảnh cho mục mới";
      setStatusMessage({ type: "error", text: String(errorMsg) });
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Helper cho Chế độ Tự viết tay thủ công (Manual 5)
  const compileManualText = (): string => {
    const sec5Title = manualMode === "plan" ? "Đăng bài" : "Công việc tồn đọng";
    const parseLines = (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return ["0"];
      const lines = trimmed
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return lines.length > 0 ? lines : ["0"];
    };

    const targetDate = manualMode === "plan" ? tomorrowPlanDate : todayReportDate;
    const caption = formatCaption(manualMode, targetDate);

    let compiled = `${caption}\n\n`;
    compiled += `1. Chốt đơn\n${parseLines(manualSections.chotDon).join("\n")}\n\n`;
    compiled += `2. Gặp mặt\n${parseLines(manualSections.gapMat).join("\n")}\n\n`;
    compiled += `3. Gửi mẫu, cắt mẫu\n${parseLines(manualSections.guiMau).join("\n")}\n\n`;
    compiled += `4. Liên hệ khách hàng\n${parseLines(manualSections.lienHe).join("\n")}\n\n`;
    compiled += `5. ${sec5Title}\n${parseLines(manualSections.sec5).join("\n")}\n\n`;

    if (manualMode === "plan") {
      manualExtraTodos.forEach((todo, idx) => {
        if (todo.title.trim() || todo.note.trim()) {
          const numStr = String(6 + idx);
          const t = todo.title.trim() || `Công việc #${numStr}`;
          compiled += `${numStr}. ${t}\n${parseLines(todo.note).join("\n")}\n\n`;
        }
      });
    }

    return compiled.trim();
  };

  const handleRenderFromManual = async () => {
    const compiled = compileManualText();
    setManualFinalText(compiled);
    setIsRenderingManual(true);
    setStatusMessage(null);

    try {
      const targetDate = manualMode === "plan" ? tomorrowPlanDate : todayReportDate;
      const caption = formatCaption(manualMode, targetDate);
      const res = await renderLiveImageApi({
        content: compiled,
        title: caption,
      });
      setManualPreviewImg(res.image_data_url);

      if (manualMode === "report") {
        setTodayReportText(compiled);
        setTodayReportImg(res.image_data_url);
      } else {
        setTomorrowPlanText(compiled);
        setTomorrowPlanImg(res.image_data_url);
      }

      setStatusMessage({
        type: "success",
        text: `Đã tạo ảnh ${caption} từ các mục tự viết tay thành công!`,
      });
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err?.response?.data?.detail || "Lỗi khi tạo ảnh thủ công",
      });
    } finally {
      setIsRenderingManual(false);
    }
  };

  // Reset Draft
  const handleResetDraft = () => {
    if (window.confirm("Bạn có chắc chắn muốn làm mới toàn bộ nội dung bản nháp không?")) {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}
      setRawInput("");
      setTodayReportText("");
      setTodayReportImg("");
      setTomorrowPlanText("");
      setTomorrowPlanImg("");
      setManualSections({
        chotDon: "",
        gapMat: "",
        guiMau: "",
        lienHe: "",
        sec5: "",
      });
      setManualExtraTodos([]);
      setManualFinalText("");
      setManualPreviewImg("");
      setStatusMessage({
        type: "success",
        text: "Đã làm mới bản nháp thành công!",
      });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Dán từ bản ghi âm
  const handlePasteTranscript = () => {
    if (initialTranscriptText) {
      setRawInput(initialTranscriptText);
      setInputMethod("ai_auto");
      setStatusMessage({
        type: "success",
        text: "Đã dán nội dung từ bản phiên âm ghi âm mới nhất!",
      });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Xóa tin nhắn vừa gửi trên Telegram
  const handleDeleteLastSentMessage = async () => {
    if (!lastSentMessage?.messageId) return;

    const ok = window.confirm(
      `Bạn có chắc chắn muốn xóa tin nhắn và ảnh vừa gửi ("${lastSentMessage.caption}") trên nhóm Telegram không?`
    );
    if (!ok) return;

    setIsDeletingMsg(true);
    setStatusMessage(null);

    try {
      await deleteMessageApi({
        message_id: lastSentMessage.messageId,
        chat_id: lastSentMessage.chatId,
      });

      const captionDeleted = lastSentMessage.caption;
      setLastSentMessage(null);
      localStorage.removeItem("sale_tool_last_sent_msg");

      setStatusMessage({
        type: "success",
        text: `Đã xóa thành công tin nhắn và ảnh ("${captionDeleted}") khỏi nhóm Telegram!`,
      });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail || err?.message || "Lỗi khi xóa tin nhắn Telegram";
      setStatusMessage({ type: "error", text: String(errorMsg) });
    } finally {
      setIsDeletingMsg(false);
    }
  };

  const handleCopy = (text: string, type: "report" | "plan" | "manual") => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  const handleDownload = (imgUrl: string, caption: string) => {
    if (!imgUrl) return;
    const a = document.createElement("a");
    a.href = imgUrl;
    a.download = `${caption.replace(/[\/\s]/g, "_")}.png`;
    a.click();
  };

  return (
    <div className="w-full flex flex-col gap-5 select-none">
      {/* THANH HEADER ĐIỀU KHIỂN & BẬT TẮT CHẾ ĐỘ TEST */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#12131A] p-4 sm:p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
              <span>Báo cáo & Kế hoạch AI</span>
              <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/30">
                Combo 2-trong-1
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Nhập 1 lần: AI tự động tách Báo cáo hôm nay (5 mục) & Kế hoạch ngày mai (&lt;10 mục)
            </p>
          </div>
        </div>

        {/* Người phụ trách & Nút làm mới bản nháp */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Phụ trách: <strong className="text-white font-semibold">Chiến Trần</strong></span>
          </div>

          <button
            type="button"
            onClick={handleResetDraft}
            title="Làm mới bản nháp"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-rose-300 hover:bg-rose-500/10 border border-white/[0.08] hover:border-rose-500/30 transition-all cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* CHỌN PHƯƠNG THỨC: 1. AI TỰ ĐỘNG vs 2. TỰ VIẾT TAY THỦ CÔNG */}
      <div className="flex items-center gap-2 p-1.5 bg-[#12131A] rounded-2xl border border-white/[0.08]">
        <button
          type="button"
          onClick={() => setInputMethod("ai_auto")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer",
            inputMethod === "ai_auto"
              ? "bg-[#2563EB] text-white shadow-md shadow-blue-600/30"
              : "text-neutral-400 hover:text-white"
          )}
        >
          <Bot className="h-4 w-4 text-cyan-300" />
          <span>1. Tóm tắt AI (1 chạm sinh cả Báo cáo & Kế hoạch)</span>
        </button>

        <button
          type="button"
          onClick={() => setInputMethod("manual_5")}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold transition-all cursor-pointer",
            inputMethod === "manual_5"
              ? "bg-[#2563EB] text-white shadow-md shadow-blue-600/30"
              : "text-neutral-400 hover:text-white"
          )}
        >
          <ListPlus className="h-4 w-4 text-emerald-300" />
          <span>2. Tự viết tay thủ công (5 ô mục chuẩn)</span>
        </button>
      </div>

      {/* THÔNG BÁO TRẠNG THÁI TOÀN CỤC */}
      {statusMessage && (
        <div
          className={cn(
            "flex items-center gap-2.5 p-3.5 rounded-2xl text-xs font-medium border shadow-lg animate-in fade-in duration-200",
            statusMessage.type === "success" && "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
            statusMessage.type === "error" && "bg-rose-500/10 border-rose-500/30 text-rose-300",
            statusMessage.type === "warning" && "bg-amber-500/10 border-amber-500/30 text-amber-300"
          )}
        >
          {statusMessage.type === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
          {statusMessage.type === "error" && <AlertCircle className="h-4 w-4 shrink-0" />}
          {statusMessage.type === "warning" && <Clock className="h-4 w-4 shrink-0" />}
          <span className="flex-1">{statusMessage.text}</span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-neutral-400 hover:text-white p-1 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* DANH SÁCH LỊCH HẸN GỬI TỰ ĐỘNG (NẾU CÓ) */}
      {scheduledItems.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
            <span className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 animate-spin text-amber-400" />
              <span>Hàng đợi tự động gửi sang Telegram ({scheduledItems.length} mục đang chờ):</span>
            </span>
            <span className="text-[11px] text-neutral-400">Giờ hiện tại: {currentTimeStr}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            {scheduledItems.map((item, idx) => (
              <div
                key={idx}
                className="p-2.5 rounded-xl bg-black/40 border border-amber-500/20 text-xs text-neutral-300 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold text-white">{item.caption}</div>
                  <div className="text-[11px] text-amber-400/90">
                    Khung giờ gửi: {item.scheduledTimeStr}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setScheduledItems((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="text-neutral-500 hover:text-rose-400 p-1 text-[11px] cursor-pointer"
                  title="Hủy hẹn gửi"
                >
                  Hủy
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHƯƠNG THỨC 1: AI TỰ ĐỘNG (COMBO BÁO CÁO & KẾ HOẠCH) */}
      {/* ========================================================================= */}
      {inputMethod === "ai_auto" && (
        <div className="flex flex-col gap-5">
          {/* Ô NHẬP GHI CHÉP THÔ (TOÀN BỘ NGÀY HÔM NAY) */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#12131A] p-4 sm:p-5 shadow-xl flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-white flex items-center gap-2">
                <PenLine className="h-4 w-4 text-blue-400" />
                <span>Ghi chép / Biên bản / Bóc băng cuộc gọi ngày hôm nay:</span>
              </label>

              <div className="flex items-center gap-2">
                {initialTranscriptText && (
                  <button
                    type="button"
                    onClick={handlePasteTranscript}
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg transition-colors cursor-pointer"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    <span>Dán từ ghi âm</span>
                  </button>
                )}
                <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <span>Ngày:</span>
                  <input
                    type="date"
                    value={todayReportDate}
                    onChange={(e) => handleTodayDateChange(e.target.value)}
                    style={{ colorScheme: "dark" }}
                    className="bg-black/40 border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-white"
                  />
                </div>
              </div>
            </div>

            <textarea
              rows={5}
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder="Dán hoặc gõ toàn bộ ghi chép hôm nay: khách đã gặp, đơn chốt, mẫu vải đã cắt, việc còn tồn đọng nợ nần, dự định ngày mai cần làm gì... AI sẽ tự động phân loại thành Báo cáo hôm nay & Kế hoạch ngày mai!"
              className="w-full bg-black/40 border border-white/[0.08] rounded-xl p-3.5 text-sm text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500 resize-none transition-colors leading-relaxed"
            />

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-neutral-500">
                {rawInput.length > 0 ? `${rawInput.length} ký tự` : "Hỗ trợ văn bản rất dài không giới hạn độ dài"}
              </div>

              <button
                type="button"
                onClick={handleGenerateCombo}
                disabled={isGeneratingAi || !rawInput.trim()}
                className="py-3 px-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>AI đang đọc hiểu và sinh Báo cáo & Kế hoạch...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>Tạo Báo cáo & Kế hoạch bằng AI</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 2 KHỐI ĐẦU RA TRẢ VỀ: 1. BÁO CÁO HÔM NAY & 2. KẾ HOẠCH NGÀY MAI */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* ===================== KHỐI 1: BÁO CÁO HÔM NAY (5 MỤC) ===================== */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#12131A] p-4 sm:p-5 shadow-xl flex flex-col gap-4">
              {/* Header Khối Báo cáo */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                    1
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Báo cáo hôm nay (5 mục chuẩn)</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                        {todayReportCaption}
                      </span>
                    </h3>
                  </div>
                </div>

                {/* Badge giờ gửi */}
                <div className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-white/[0.03]">
                  <Clock className="h-3 w-3 text-neutral-400" />
                  <span>Giờ chuẩn: 18h - 20h tối</span>
                  {timeStatus.isReportValid ? (
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-amber-400 ml-0.5" />
                  )}
                </div>
              </div>

              {/* Ô soạn thảo / chỉnh sửa Báo cáo */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-neutral-400">
                  <span>Văn bản Báo cáo (Tự do chỉnh sửa):</span>
                  {todayReportText && (
                    <button
                      type="button"
                      onClick={() => handleCopy(todayReportText, "report")}
                      className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {copiedType === "report" ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-400" />
                          <span className="text-emerald-400">Đã copy</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <textarea
                  rows={8}
                  value={todayReportText}
                  onChange={(e) => setTodayReportText(e.target.value)}
                  placeholder="Nội dung Báo cáo hôm nay (5 mục) do AI sinh sẽ xuất hiện tại đây. Bạn có thể tự do gõ sửa..."
                  className="w-full bg-black/50 border border-white/[0.08] focus:border-blue-500 rounded-xl p-3 text-xs sm:text-sm text-neutral-100 placeholder-neutral-600 resize-y leading-relaxed font-sans"
                />

                {/* Nút chủ động cập nhật ảnh Báo cáo */}
                <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                  <span>💡 Tự động cập nhật ảnh sau khi gõ, hoặc:</span>
                  <button
                    type="button"
                    onClick={handleUpdateReportImageNow}
                    disabled={isUpdatingReportImg || !todayReportText.trim()}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg font-medium transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isUpdatingReportImg ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 text-blue-400" />
                    )}
                    <span>Cập nhật ảnh Báo cáo</span>
                  </button>
                </div>
              </div>

              {/* Ảnh thẻ Báo cáo */}
              {todayReportImg && (
                <div className="flex flex-col gap-2 p-2 bg-black/60 rounded-xl border border-white/[0.06]">
                  <div className="flex items-center justify-between px-2 text-[11px] text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5 text-blue-400" />
                      <span>Ảnh thẻ Báo cáo Dark Mode:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownload(todayReportImg, todayReportCaption)}
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 cursor-pointer"
                    >
                      <Download className="h-3 w-3" />
                      <span>Tải ảnh</span>
                    </button>
                  </div>
                  <div className="w-full flex justify-center overflow-hidden rounded-lg">
                    <img
                      src={todayReportImg}
                      alt="Ảnh Báo cáo hôm nay"
                      className="w-full max-w-[420px] h-auto rounded object-contain border border-neutral-800 shadow-md"
                    />
                  </div>
                </div>
              )}

              {/* CỤM NÚT HẸN GIỜ & GỬI BÁO CÁO */}
              <div className="flex flex-col sm:flex-row gap-2 mt-auto pt-2">
                {isReportScheduled ? (
                  <div className="flex-1 flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold gap-2">
                    <span className="flex items-center gap-1.5 truncate">
                      <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span className="truncate">Đã hẹn gửi 18:00</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelReportSchedule}
                      className="text-rose-400 hover:text-rose-300 text-[11px] px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 cursor-pointer shrink-0"
                    >
                      Hủy hẹn
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleScheduleReportNow}
                    disabled={!todayReportText.trim()}
                    title={
                      !isReportForToday
                        ? `Chỉ hỗ trợ hẹn giờ cho Báo cáo của ngày hôm nay (${actualTodayStr}). Ngày khác chỉ có thể bấm "Gửi ngay".`
                        : timeStatus.isReportLate
                        ? "Đã quá khung giờ gửi chuẩn (18:00 - 20:00 tối). Không thể hẹn gửi tự động nữa."
                        : timeStatus.isReportValid
                        ? "Đang trong khung giờ chuẩn 18h-20h: Bấm để kích hoạt hẹn gửi tự động!"
                        : "Hẹn giờ gửi tự động vào lúc 18:00 hôm nay"
                    }
                    className="flex-1 py-2.5 px-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {!isReportForToday
                        ? "Chỉ gửi trực tiếp (Khác ngày)"
                        : timeStatus.isReportLate
                        ? "Đã quá 20h (Gửi trực tiếp)"
                        : timeStatus.isReportValid
                        ? "Hẹn gửi ngay (18h-20h)"
                        : "Hẹn giờ (18:00)"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSendReport}
                  disabled={isSendingReport || !todayReportText.trim()}
                  className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSendingReport ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Gửi ngay ({todayReportCaption})</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* ===================== KHỐI 2: KẾ HOẠCH NGÀY MAI (<10 MỤC) ===================== */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#12131A] p-4 sm:p-5 shadow-xl flex flex-col gap-4">
              {/* Header Khối Kế hoạch */}
              <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <span className="h-6 w-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center text-xs font-bold">
                    2
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Kế hoạch ngày mai (&lt;10 mục)</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium">
                        {tomorrowPlanCaption}
                      </span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Date picker cho Kế hoạch ngày mai */}
                  <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                    <span>Ngày:</span>
                    <input
                      type="date"
                      value={tomorrowPlanDate}
                      onChange={(e) => setTomorrowPlanDate(e.target.value)}
                      style={{ colorScheme: "dark" }}
                      className="bg-black/40 border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-white"
                    />
                  </div>

                  {/* Badge giờ gửi */}
                  <div className="flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border bg-white/[0.03]">
                    <Clock className="h-3 w-3 text-neutral-400" />
                    <span>Giờ chuẩn: 08h00 - 08h25 sáng</span>
                    {timeStatus.isPlanValid ? (
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                    ) : timeStatus.isPlanEarly ? (
                      <span className="h-2 w-2 rounded-full bg-blue-400 ml-0.5" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-rose-400 ml-0.5" />
                    )}
                  </div>
                </div>
              </div>

              {/* Ô soạn thảo / chỉnh sửa Kế hoạch */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs text-neutral-400 flex-wrap gap-2">
                  <span>Văn bản Kế hoạch:</span>
                  <div className="flex items-center gap-2">
                    {/* NÚT TÁI SỬ DỤNG MODULE THÊM MỤC CÔNG VIỆC MỚI VÀO KẾ HOẠCH */}
                    <button
                      type="button"
                      onClick={handleOpenAddSectionModal}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-purple-300 hover:text-white bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 rounded-lg transition-all cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5 text-purple-400" />
                      <span>+ Thêm mục #{nextSectionNum}</span>
                    </button>

                    {tomorrowPlanText && (
                      <button
                        type="button"
                        onClick={() => handleCopy(tomorrowPlanText, "plan")}
                        className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {copiedType === "plan" ? (
                          <>
                            <Check className="h-3 w-3 text-emerald-400" />
                            <span className="text-emerald-400">Đã copy</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <textarea
                  rows={8}
                  value={tomorrowPlanText}
                  onChange={(e) => setTomorrowPlanText(e.target.value)}
                  placeholder="Nội dung Kế hoạch ngày mai do AI sinh sẽ xuất hiện tại đây. Bạn có thể tự do gõ sửa hoặc bấm nút [+ Thêm mục] để thêm công việc mới..."
                  className="w-full bg-black/50 border border-white/[0.08] focus:border-purple-500 rounded-xl p-3 text-xs sm:text-sm text-neutral-100 placeholder-neutral-600 resize-y leading-relaxed font-sans"
                />

                {/* Nút chủ động cập nhật ảnh Kế hoạch */}
                <div className="flex items-center justify-between text-[11px] text-neutral-400 pt-1">
                  <span>💡 Tự động cập nhật ảnh sau khi gõ, hoặc:</span>
                  <button
                    type="button"
                    onClick={handleUpdatePlanImageNow}
                    disabled={isUpdatingPlanImg || !tomorrowPlanText.trim()}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 rounded-lg font-medium transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isUpdatingPlanImg ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 text-purple-400" />
                    )}
                    <span>Cập nhật ảnh Kế hoạch</span>
                  </button>
                </div>
              </div>

              {/* Ảnh thẻ Kế hoạch */}
              {tomorrowPlanImg && (
                <div className="flex flex-col gap-2 p-2 bg-black/60 rounded-xl border border-white/[0.06]">
                  <div className="flex items-center justify-between px-2 text-[11px] text-neutral-400">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3.5 w-3.5 text-purple-400" />
                      <span>Ảnh thẻ Kế hoạch Dark Mode:</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownload(tomorrowPlanImg, tomorrowPlanCaption)}
                      className="flex items-center gap-1 text-purple-400 hover:text-purple-300 cursor-pointer"
                    >
                      <Download className="h-3 w-3" />
                      <span>Tải ảnh</span>
                    </button>
                  </div>
                  <div className="w-full flex justify-center overflow-hidden rounded-lg">
                    <img
                      src={tomorrowPlanImg}
                      alt="Ảnh Kế hoạch ngày mai"
                      className="w-full max-w-[420px] h-auto rounded object-contain border border-neutral-800 shadow-md"
                    />
                  </div>
                </div>
              )}

              {/* CỤM NÚT HẸN GIỜ & GỬI KẾ HOẠCH */}
              <div className="flex flex-col sm:flex-row gap-2 mt-auto pt-2">
                {isPlanScheduled ? (
                  <div className="flex-1 flex items-center justify-between p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold gap-2">
                    <span className="flex items-center gap-1.5 truncate">
                      <Clock className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                      <span className="truncate">Đã hẹn gửi 08:00 sáng mai</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCancelPlanSchedule}
                      className="text-rose-400 hover:text-rose-300 text-[11px] px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 cursor-pointer shrink-0"
                    >
                      Hủy hẹn
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleSchedulePlanNow}
                    disabled={!tomorrowPlanText.trim()}
                    title={
                      tomorrowPlanDate !== actualTodayStr && tomorrowPlanDate !== actualTomorrowStr
                        ? `Chỉ hỗ trợ hẹn gửi cho Kế hoạch hôm nay (${actualTodayStr}) hoặc ngày mai (${actualTomorrowStr}). Ngày khác chỉ có thể bấm "Gửi ngay".`
                        : tomorrowPlanDate === actualTodayStr && timeStatus.isPlanLate
                        ? "Đã quá khung giờ gửi Kế hoạch hôm nay (sau 08:25 sáng). Không thể hẹn gửi tự động nữa."
                        : "Hẹn gửi tự động vào khung giờ chuẩn 08:00 - 08:25"
                    }
                    className="flex-1 py-2.5 px-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {tomorrowPlanDate !== actualTodayStr && tomorrowPlanDate !== actualTomorrowStr
                        ? "Chỉ gửi trực tiếp (Khác ngày)"
                        : tomorrowPlanDate === actualTodayStr && timeStatus.isPlanLate
                        ? "Đã quá 08h25 (Gửi trực tiếp)"
                        : tomorrowPlanDate === actualTodayStr && timeStatus.isPlanValid
                        ? "Hẹn gửi ngay (08:00 - 08:25)"
                        : tomorrowPlanDate === actualTodayStr
                        ? "Hẹn gửi (08:00 sáng)"
                        : "Hẹn gửi (08:00 sáng mai)"}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleSendPlan}
                  disabled={isSendingPlan || !tomorrowPlanText.trim()}
                  className="flex-1 py-2.5 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/25 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSendingPlan ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-3.5 w-3.5" />
                      <span>Gửi ngay ({tomorrowPlanCaption})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PHƯƠNG THỨC 2: TỰ VIẾT TAY THỦ CÔNG (GIỮ NGUYÊN CHO NGƯỜI DÙNG THÍCH TỰ NHẬP) */}
      {/* ========================================================================= */}
      {inputMethod === "manual_5" && (
        <div className="rounded-2xl border border-white/[0.08] bg-[#12131A] p-4 sm:p-5 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <ListPlus className="h-5 w-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Chế độ tự viết tay thủ công</h3>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {/* Chọn ngày cho chế độ viết tay */}
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <span>{manualMode === "report" ? "Ngày báo cáo:" : "Ngày kế hoạch:"}</span>
                <input
                  type="date"
                  value={manualMode === "report" ? todayReportDate : tomorrowPlanDate}
                  onChange={(e) => {
                    if (manualMode === "report") {
                      handleTodayDateChange(e.target.value);
                    } else {
                      setTomorrowPlanDate(e.target.value);
                    }
                  }}
                  style={{ colorScheme: "dark" }}
                  className="bg-black/50 border border-white/[0.12] rounded-lg px-2 py-1 text-xs text-white"
                />
              </div>

              {/* Chuyển đổi Viết tay: Báo cáo vs Kế hoạch */}
              <div className="grid grid-cols-2 p-1 bg-black/50 border border-white/[0.08] rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setManualMode("report")}
                  className={cn(
                    "py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    manualMode === "report"
                      ? "bg-[#2563EB] text-white shadow"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  Viết tay Báo cáo ({todayReportCaption})
                </button>

                <button
                  type="button"
                  onClick={() => setManualMode("plan")}
                  className={cn(
                    "py-1.5 px-3 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    manualMode === "plan"
                      ? "bg-[#2563EB] text-white shadow"
                      : "text-neutral-400 hover:text-white"
                  )}
                >
                  Viết tay Kế hoạch ({tomorrowPlanCaption})
                </button>
              </div>
            </div>
          </div>

          {/* 5 Ô nhập thủ công */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Mục 1: Chốt đơn */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-blue-400">1. Chốt đơn:</label>
              <textarea
                rows={2}
                value={manualSections.chotDon}
                onChange={(e) => setManualSections({ ...manualSections, chotDon: e.target.value })}
                placeholder="Ví dụ: - 01 đơn vải mè 500m (Anh Tuấn)..."
                className="w-full bg-black/40 border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 resize-y"
              />
            </div>

            {/* Mục 2: Gặp mặt */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-purple-400">2. Gặp mặt:</label>
              <textarea
                rows={2}
                value={manualSections.gapMat}
                onChange={(e) => setManualSections({ ...manualSections, gapMat: e.target.value })}
                placeholder="Ví dụ: - Gặp Chị Huyền duyệt mẫu kaki..."
                className="w-full bg-black/40 border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-purple-500 resize-y"
              />
            </div>

            {/* Mục 3: Gửi mẫu, cắt mẫu */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-emerald-400">3. Gửi mẫu, cắt mẫu:</label>
              <textarea
                rows={2}
                value={manualSections.guiMau}
                onChange={(e) => setManualSections({ ...manualSections, guiMau: e.target.value })}
                placeholder="Ví dụ: - Cắt mẫu thun lạnh gửi khách tỉnh..."
                className="w-full bg-black/40 border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 resize-y"
              />
            </div>

            {/* Mục 4: Liên hệ khách hàng */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-amber-400">4. Liên hệ khách hàng:</label>
              <textarea
                rows={2}
                value={manualSections.lienHe}
                onChange={(e) => setManualSections({ ...manualSections, lienHe: e.target.value })}
                placeholder="Ví dụ: - Hoàng Bùi-1566: Báo giá lô cotton..."
                className="w-full bg-black/40 border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500 resize-y"
              />
            </div>

            {/* Mục 5: Đăng bài (Kế hoạch) hoặc Công việc tồn đọng (Báo cáo) */}
            <div className="sm:col-span-2 flex flex-col gap-1">
              <label className="text-xs font-semibold text-rose-400">
                {manualMode === "plan" ? "5. Đăng bài:" : "5. Công việc tồn đọng:"}
              </label>
              <textarea
                rows={2}
                value={manualSections.sec5}
                onChange={(e) => setManualSections({ ...manualSections, sec5: e.target.value })}
                placeholder={
                  manualMode === "plan"
                    ? "Ví dụ: Đăng 2 bài Zalo sỉ, video Tiktok..."
                    : "Ví dụ: Hợp đồng anh Tuấn chưa gửi scan, nợ tiền hàng..."
                }
                className="w-full bg-black/40 border border-white/[0.08] rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-rose-500 resize-y"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleRenderFromManual}
            disabled={isRenderingManual}
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer mt-1"
          >
            {isRenderingManual ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang tạo ảnh từ các mục viết tay...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                <span>Tạo ảnh từ 5 mục viết tay ({manualMode === "plan" ? tomorrowPlanCaption : todayReportCaption})</span>
              </>
            )}
          </button>

          {/* Preview kết quả viết tay */}
          {manualFinalText && (
            <div className="flex flex-col gap-3 pt-3 border-t border-white/[0.08]">
              <div className="flex items-center justify-between text-xs text-neutral-300">
                <span className="font-semibold">Văn bản đã tạo từ các ô nhập:</span>
                <span className="text-[11px] text-neutral-400">
                  {manualMode === "plan" ? tomorrowPlanCaption : todayReportCaption}
                </span>
              </div>
              <textarea
                rows={6}
                value={manualFinalText}
                onChange={(e) => {
                  const val = e.target.value;
                  setManualFinalText(val);
                  if (manualMode === "report") {
                    setTodayReportText(val);
                  } else {
                    setTomorrowPlanText(val);
                  }
                }}
                className="w-full bg-black/50 border border-white/[0.1] rounded-xl p-3 text-xs text-white font-sans leading-relaxed"
              />

              {/* Nút cập nhật ảnh từ văn bản viết tay */}
              <div className="flex items-center justify-between text-[11px] text-neutral-400">
                <span>💡 Bạn có thể trực tiếp sửa văn bản ở ô trên:</span>
                <button
                  type="button"
                  onClick={handleUpdateManualImageNow}
                  disabled={isUpdatingManualImg || !manualFinalText.trim()}
                  className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg font-medium transition-all cursor-pointer disabled:opacity-50"
                >
                  {isUpdatingManualImg ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
                  )}
                  <span>Cập nhật ảnh {manualMode === "plan" ? "Kế hoạch" : "Báo cáo"}</span>
                </button>
              </div>

              {manualPreviewImg && (
                <div className="w-full flex justify-center p-2 bg-black/60 rounded-xl border border-white/[0.06]">
                  <img
                    src={manualPreviewImg}
                    alt="Xem trước viết tay"
                    className="w-full max-w-[420px] h-auto rounded border border-neutral-800"
                  />
                </div>
              )}

              {/* CỤM NÚT HẸN GIỜ & GỬI NGAY CHO VIẾT TAY */}
              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                {manualMode === "report" ? (
                  isReportScheduled ? (
                    <div className="flex-1 flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold gap-2">
                      <span className="flex items-center gap-1.5 truncate">
                        <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span className="truncate">Đã hẹn gửi 18:00</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleCancelReportSchedule}
                        className="text-rose-400 hover:text-rose-300 text-[11px] px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 cursor-pointer shrink-0"
                      >
                        Hủy hẹn
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleScheduleReportNow}
                      disabled={!todayReportText.trim()}
                      title={
                        !isReportForToday
                          ? `Chỉ hỗ trợ hẹn giờ cho Báo cáo của ngày hôm nay (${actualTodayStr}). Ngày khác chỉ có thể bấm "Gửi ngay".`
                          : timeStatus.isReportLate
                          ? "Đã quá khung giờ gửi chuẩn (18:00 - 20:00 tối). Không thể hẹn gửi tự động nữa."
                          : timeStatus.isReportValid
                          ? "Đang trong khung giờ chuẩn 18h-20h: Bấm để kích hoạt hẹn gửi tự động!"
                          : "Hẹn giờ gửi tự động vào lúc 18:00 hôm nay"
                      }
                      className="flex-1 py-2.5 px-4 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {!isReportForToday
                          ? "Chỉ gửi trực tiếp (Khác ngày)"
                          : timeStatus.isReportLate
                          ? "Đã quá 20h (Gửi trực tiếp)"
                          : timeStatus.isReportValid
                          ? "Hẹn gửi ngay (18h-20h)"
                          : "Hẹn giờ (18:00)"}
                      </span>
                    </button>
                  )
                ) : (
                  isPlanScheduled ? (
                    <div className="flex-1 flex items-center justify-between p-2.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold gap-2">
                      <span className="flex items-center gap-1.5 truncate">
                        <Clock className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                        <span className="truncate">Đã hẹn gửi 08:00 sáng mai</span>
                      </span>
                      <button
                        type="button"
                        onClick={handleCancelPlanSchedule}
                        className="text-rose-400 hover:text-rose-300 text-[11px] px-2 py-1 rounded bg-rose-500/15 hover:bg-rose-500/25 cursor-pointer shrink-0"
                      >
                        Hủy hẹn
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSchedulePlanNow}
                      disabled={!tomorrowPlanText.trim()}
                      title={
                        tomorrowPlanDate !== actualTodayStr && tomorrowPlanDate !== actualTomorrowStr
                          ? `Chỉ hỗ trợ hẹn gửi cho Kế hoạch hôm nay (${actualTodayStr}) hoặc ngày mai (${actualTomorrowStr}). Ngày khác chỉ có thể bấm "Gửi ngay".`
                          : tomorrowPlanDate === actualTodayStr && timeStatus.isPlanLate
                          ? "Đã quá khung giờ gửi Kế hoạch hôm nay (sau 08:25 sáng). Không thể hẹn gửi tự động nữa."
                          : "Hẹn gửi tự động vào khung giờ chuẩn 08:00 - 08:25"
                      }
                      className="flex-1 py-2.5 px-4 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {tomorrowPlanDate !== actualTodayStr && tomorrowPlanDate !== actualTomorrowStr
                          ? "Chỉ gửi trực tiếp (Khác ngày)"
                          : tomorrowPlanDate === actualTodayStr && timeStatus.isPlanLate
                          ? "Đã quá 08h25 (Gửi trực tiếp)"
                          : tomorrowPlanDate === actualTodayStr && timeStatus.isPlanValid
                          ? "Hẹn gửi ngay (08:00 - 08:25)"
                          : tomorrowPlanDate === actualTodayStr
                          ? "Hẹn gửi (08:00 sáng)"
                          : "Hẹn gửi (08:00 sáng mai)"}
                      </span>
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={manualMode === "plan" ? handleSendPlan : handleSendReport}
                  disabled={
                    manualMode === "plan"
                      ? isSendingPlan || !tomorrowPlanText.trim()
                      : isSendingReport || !todayReportText.trim()
                  }
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-50"
                >
                  {((manualMode === "plan" && isSendingPlan) || (manualMode === "report" && isSendingReport)) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang gửi...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>
                        Gửi ngay ({manualMode === "plan" ? tomorrowPlanCaption : todayReportCaption})
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* NÚT XÓA TIN NHẮN VỪA GỬI (NẾU CÓ) */}
      {lastSentMessage && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-rose-300">
            <Trash2 className="h-4 w-4 shrink-0 text-rose-400" />
            <span>
              Tin nhắn vừa gửi vào Telegram: <b>{lastSentMessage.caption}</b> (ID: {lastSentMessage.messageId})
            </span>
          </div>
          <button
            type="button"
            onClick={handleDeleteLastSentMessage}
            disabled={isDeletingMsg}
            className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            {isDeletingMsg ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang xóa...</span>
              </>
            ) : (
              <span>Xóa tin nhắn này</span>
            )}
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* POP-UP MODAL THÊM ĐẦU VIỆC (MỤC 6, 7...) VÀO KẾ HOẠCH (TÁI SỬ DỤNG) */}
      {/* ========================================================================= */}
      {isAddSectionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsAddSectionModalOpen(false)}
        >
          <div
            className="relative w-full max-w-lg bg-[#141622] border border-purple-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-left select-text"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <PlusCircle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Thêm công việc #{nextSectionNum} vào Kế hoạch ngày mai
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Tự động đưa vào văn bản & cập nhật lại ảnh thẻ Kế hoạch ngay lập tức
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSectionModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-col gap-3.5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-200">
                  Tiêu đề công việc #{nextSectionNum}:
                </label>
                <input
                  type="text"
                  value={modalTodoTitle}
                  onChange={(e) => setModalTodoTitle(e.target.value)}
                  placeholder="Ví dụ: Đăng bài nhóm sỉ Zalo, Thu công nợ, Kiểm tra kho vải..."
                  autoFocus
                  className="w-full bg-black/50 border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500 placeholder:text-neutral-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-200">
                  Chi tiết nội dung / Ghi chú (xuống dòng như Notes):
                </label>
                <textarea
                  rows={4}
                  value={modalTodoNote}
                  onChange={(e) => setModalTodoNote(e.target.value)}
                  placeholder={"Ví dụ:\n- Đăng bài vào 3 nhóm sỉ Zalo đầu giờ sáng\n- Cập nhật bảng giá vải đũi mới\n- Thu tiền đơn vải mè anh Tuấn"}
                  className="w-full bg-black/50 border border-white/[0.12] rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-purple-500 placeholder:text-neutral-500 resize-y leading-relaxed"
                />
                <span className="text-[10px] text-neutral-500">
                  Mỗi dòng sẽ tự động tạo thành một gạch đầu dòng (•) trong văn bản và thẻ ảnh Dark Mode.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => setIsAddSectionModalOpen(false)}
                disabled={isSubmittingModal}
                className="px-4 py-2.5 rounded-xl text-xs font-medium text-neutral-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmAddSection}
                disabled={isSubmittingModal || (!modalTodoTitle.trim() && !modalTodoNote.trim())}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-500/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingModal ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang cập nhật...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Xác nhận & Cập nhật ảnh Kế hoạch</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
