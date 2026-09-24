import { useState, useEffect } from "react";
import {
  Calendar,
  FileText,
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
} from "lucide-react";
import {
  generateReportApi,
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

interface ReportDraft {
  mode: ReportMode;
  reportDate: string;
  inputMethod: "ai_auto" | "manual_5";
  rawInput: string;
  manualSections: {
    chotDon: string;
    gapMat: string;
    guiMau: string;
    lienHe: string;
    sec5: string;
  };
  extraTodos: TodoItem[];
  finalText: string;
  previewImageUrl: string;
  previewSource: "ai" | "manual" | "none";
}

const DRAFT_STORAGE_KEY = "sale_tool_report_draft_v2";

const loadSavedDraft = (): Partial<ReportDraft> | null => {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

interface ReportStudioProps {
  initialTranscriptText?: string;
}

const getTodayLocalDateStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function ReportStudio({ initialTranscriptText = "" }: ReportStudioProps) {
  const initialDraft = loadSavedDraft();

  // 1. Chế độ & Ngày tháng (luôn mặc định theo ngày hiện tại now())
  const [mode, setMode] = useState<ReportMode>(() => initialDraft?.mode || "report");
  const [reportDate, setReportDate] = useState<string>(() => {
    return getTodayLocalDateStr();
  });

  // Phương thức nhập: "ai_auto" (Nhập thô & AI tóm tắt) vs "manual_5" (Tự điền 5 ô)
  const [inputMethod, setInputMethod] = useState<"ai_auto" | "manual_5">(
    () => initialDraft?.inputMethod || "ai_auto"
  );

  // Tab hiển thị trên mobile (< lg): "edit" (Soạn thảo) vs "preview" (Xem ảnh & Gửi)
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");

  // Cách 1: Người dùng nhập thô (văn bản tự do, cực dài, bóc băng...)
  const [rawInput, setRawInput] = useState<string>(
    () => initialDraft?.rawInput ?? initialTranscriptText
  );

  // Cách 2: Tự nhập các mục thủ công (mục 5 đổi theo chế độ)
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

  // Danh sách công việc To-do bổ sung (chỉ dành cho chế độ "Kế hoạch")
  const [extraTodos, setExtraTodos] = useState<TodoItem[]>(
    () => initialDraft?.extraTodos || []
  );

  // Bản văn bản chuẩn hóa cuối cùng (dùng để gửi Telegram và copy)
  const [finalText, setFinalText] = useState<string>(() => initialDraft?.finalText || "");

  // Ảnh hiển thị (Preview Image) - Giữ cố định sau khi tạo, KHÔNG BAO GIỜ bị reset
  const [previewImageUrl, setPreviewImageUrl] = useState<string>(
    () => initialDraft?.previewImageUrl || ""
  );
  const [previewSource, setPreviewSource] = useState<"ai" | "manual" | "none">(
    () => initialDraft?.previewSource || "none"
  );

  // Loading States
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [isRenderingManual, setIsRenderingManual] = useState(false);
  const [isSendingTele, setIsSendingTele] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

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

  // Tính toán title ngắn hạn: vd "Báo cáo 24/09" hoặc "Kế hoạch 25/09"
  const getShortCaption = (m: ReportMode, dateStr: string) => {
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

  const currentCaption = getShortCaption(mode, reportDate);

  // Tự động lưu bản nháp vào localStorage để khi out Chrome mobile hoặc tab reload không bao giờ bị mất nội dung
  useEffect(() => {
    const draft: ReportDraft = {
      mode,
      reportDate,
      inputMethod,
      rawInput,
      manualSections,
      extraTodos,
      finalText,
      previewImageUrl,
      previewSource,
    };
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Nếu quota localStorage bị đầy do ảnh Data URL lớn, lưu dữ liệu text bỏ qua previewImageUrl
      try {
        localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({ ...draft, previewImageUrl: "" })
        );
      } catch {}
    }
  }, [
    mode,
    reportDate,
    inputMethod,
    rawInput,
    manualSections,
    extraTodos,
    finalText,
    previewImageUrl,
    previewSource,
  ]);

  const handleResetDraft = () => {
    if (window.confirm("Bạn có chắc chắn muốn xóa bản nháp hiện tại để làm mới không?")) {
      try {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {}
      setRawInput("");
      setManualSections({
        chotDon: "",
        gapMat: "",
        guiMau: "",
        lienHe: "",
        sec5: "",
      });
      setExtraTodos([]);
      setFinalText("");
      setPreviewImageUrl("");
      setPreviewSource("none");
      setStatusMessage({
        type: "success",
        text: "Đã làm mới bản nháp thành công!",
      });
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  // Xử lý dán văn bản từ bản ghi âm gần nhất
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

  // 1. Hành động: "Tạo nội dung bằng AI" (Từ Ô nhập thô số 1)
  const handleGenerateByAi = async () => {
    if (!rawInput.trim()) {
      setStatusMessage({
        type: "error",
        text: "Vui lòng nhập nội dung ghi chép hoặc biên bản cuộc gặp!",
      });
      return;
    }

    setIsGeneratingAi(true);
    setStatusMessage(null);

    try {
      const res = await generateReportApi({
        mode,
        report_date: reportDate,
        content: rawInput.trim(),
      });

      let fullText = res.summary_text;

      // Nếu ở chế độ Kế hoạch và có thêm To-do list bổ sung (việc thứ 6, 7...)
      if (mode === "plan" && extraTodos.length > 0) {
        const matches = fullText.match(/^(\d+)[\.\:]/gm) || [];
        const nums = matches
          .map((m) => parseInt(m.replace(/\D/g, "")))
          .filter((n) => !isNaN(n));
        let nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 6;

        let appended = false;
        extraTodos.forEach((todo) => {
          if (todo.title.trim() || todo.note.trim()) {
            fullText += `\n\n${nextNum}. ${todo.title.trim() || `Công việc #${nextNum}`}\n`;
            const lines = todo.note
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean);
            if (lines.length > 0) {
              lines.forEach((l) => {
                fullText += `• ${l}\n`;
              });
            } else {
              fullText += "• 0\n";
            }
            nextNum++;
            appended = true;
          }
        });

        if (appended) {
          fullText = fullText.trim();
          const imgRes = await renderLiveImageApi({
            content: fullText,
            title: currentCaption,
          });
          setPreviewImageUrl(imgRes.image_data_url);
        } else {
          setPreviewImageUrl(res.image_data_url);
        }
      } else {
        setPreviewImageUrl(res.image_data_url);
      }

      setFinalText(fullText);
      setPreviewSource("ai");
      setMobileTab("preview");

      setStatusMessage({
        type: "success",
        text:
          mode === "plan"
            ? "AI đã chuẩn hóa kế hoạch và cập nhật ảnh thẻ!"
            : "AI đã chuẩn hóa thành công 5 mục và cập nhật ảnh báo cáo!",
      });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail || err?.message || "Lỗi khi gọi API AI tạo nội dung";
      setStatusMessage({ type: "error", text: String(errorMsg) });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Helper tổng hợp nội dung văn bản từ 5 ô nhập thủ công
  const compileManualText = (): string => {
    const sec5Title = mode === "plan" ? "Đăng bài" : "Công việc tồn đọng";
    const parseLines = (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return ["0"];
      const lines = trimmed
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return lines.length > 0 ? lines : ["0"];
    };

    let compiled = `${currentCaption}\n\n`;
    compiled += `1. Chốt đơn\n${parseLines(manualSections.chotDon).join("\n")}\n\n`;
    compiled += `2. Gặp mặt\n${parseLines(manualSections.gapMat).join("\n")}\n\n`;
    compiled += `3. Gửi mẫu, cắt mẫu\n${parseLines(manualSections.guiMau).join("\n")}\n\n`;
    compiled += `4. Liên hệ khách hàng\n${parseLines(manualSections.lienHe).join("\n")}\n\n`;
    compiled += `5. ${sec5Title}\n${parseLines(manualSections.sec5).join("\n")}\n\n`;

    if (mode === "plan") {
      extraTodos.forEach((todo, idx) => {
        if (todo.title.trim() || todo.note.trim()) {
          const numStr = String(6 + idx);
          const t = todo.title.trim() || `Công việc #${numStr}`;
          compiled += `${numStr}. ${t}\n${parseLines(todo.note).join("\n")}\n\n`;
        }
      });
    }

    return compiled.trim();
  };

  // Tự động debounced update ảnh xem trước khi người dùng gõ/sửa ô văn bản chuẩn bị gửi (ô input 2)
  useEffect(() => {
    if (!finalText.trim()) return;
    const timer = setTimeout(async () => {
      try {
        const res = await renderLiveImageApi({
          content: finalText.trim(),
          title: currentCaption,
        });
        setPreviewImageUrl(res.image_data_url);
      } catch (err) {
        console.error("Lỗi khi tự động cập nhật ảnh xem trước:", err);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [finalText, currentCaption]);

  // 1b. Hành động: "Cập nhật ảnh từ văn bản đã chỉnh sửa"
  const [isUpdatingImage, setIsUpdatingImage] = useState(false);
  const handleUpdateImageFromFinalText = async () => {
    let targetText = finalText.trim();
    if (!targetText && inputMethod === "manual_5") {
      targetText = compileManualText();
      setFinalText(targetText);
    }

    if (!targetText) {
      setStatusMessage({
        type: "error",
        text: "Vui lòng nhập nội dung văn bản trước khi cập nhật ảnh!",
      });
      return;
    }

    setIsUpdatingImage(true);
    setStatusMessage(null);

    try {
      const res = await renderLiveImageApi({
        content: targetText,
        title: currentCaption,
      });

      setPreviewImageUrl(res.image_data_url);
      setMobileTab("preview");

      setStatusMessage({
        type: "success",
        text: "Đã cập nhật lại ảnh thẻ sắc nét theo văn bản mới nhất!",
      });
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail || err?.message || "Lỗi khi render ảnh từ văn bản";
      setStatusMessage({ type: "error", text: String(errorMsg) });
    } finally {
      setIsUpdatingImage(false);
    }
  };

  // Modal Thêm mục công việc mới (mục 6, 7...) vào Kế hoạch
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [modalTodoTitle, setModalTodoTitle] = useState("");
  const [modalTodoNote, setModalTodoNote] = useState("");
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  // Helper tính toán các đầu việc hiện có trong văn bản
  const getSectionNumbersFromText = (text: string): number[] => {
    const matches = (text || "").match(/^(\d+)[\.\:]/gm) || [];
    const nums = matches
      .map((m) => parseInt(m.replace(/\D/g, ""), 10))
      .filter((n) => !isNaN(n));
    return nums;
  };

  const getNextSectionNumber = (): number => {
    const nums = getSectionNumbersFromText(finalText);
    if (nums.length === 0) return 6;
    return Math.max(...nums) + 1;
  };

  const nextSectionNum = getNextSectionNumber();
  const currentTotalSections = Math.max(5, getSectionNumbersFromText(finalText).length);

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
        finalText.trim() ? finalText.trim() + newSectionBlock : newSectionBlock.trim()
      ).trim();

      setFinalText(updatedText);

      // Tự động render lại ảnh ngay lập tức
      const imgRes = await renderLiveImageApi({
        content: updatedText,
        title: currentCaption,
      });

      setPreviewImageUrl(imgRes.image_data_url);
      setPreviewSource("ai");
      setIsAddSectionModalOpen(false);
      setModalTodoTitle("");
      setModalTodoNote("");
      setMobileTab("preview");

      setStatusMessage({
        type: "success",
        text: `Đã thêm mục ${nextNum} ("${title}") vào kế hoạch và tự động cập nhật ảnh thẻ!`,
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail || err?.message || "Lỗi khi cập nhật ảnh cho mục mới";
      setStatusMessage({ type: "error", text: String(errorMsg) });
    } finally {
      setIsSubmittingModal(false);
    }
  };

  // Thao tác với To-do list bổ sung (chỉ ở chế độ Kế hoạch)
  const handleAddTodo = () => {
    setExtraTodos((prev) => [
      ...prev,
      { id: String(Date.now()), title: "", note: "" },
    ]);
  };

  const handleRemoveTodo = (id: string) => {
    setExtraTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateTodo = (id: string, field: "title" | "note", val: string) => {
    setExtraTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: val } : t))
    );
  };

  // 2. Hành động: "Tạo ảnh từ các mục thủ công"
  const handleRenderFromManual = async () => {
    const hasAnyStandard = Object.values(manualSections).some((v) => v.trim().length > 0);
    const hasAnyTodo =
      mode === "plan" &&
      extraTodos.some((t) => t.title.trim().length > 0 || t.note.trim().length > 0);

    if (!hasAnyStandard && !hasAnyTodo) {
      setStatusMessage({
        type: "error",
        text: "Vui lòng điền thông tin vào ít nhất 1 mục trước khi tạo ảnh!",
      });
      return;
    }

    setIsRenderingManual(true);
    setStatusMessage(null);

    const sec5Title = mode === "plan" ? "Đăng bài" : "Công việc tồn đọng";

    const parseLines = (raw: string) => {
      const trimmed = raw.trim();
      if (!trimmed) return ["0"];
      const lines = trimmed
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      return lines.length > 0 ? lines : ["0"];
    };

    const structuredSections: Array<{ num: string; title: string; items: string[] }> = [
      { num: "1", title: "Chốt đơn", items: parseLines(manualSections.chotDon) },
      { num: "2", title: "Gặp mặt", items: parseLines(manualSections.gapMat) },
      { num: "3", title: "Gửi mẫu, cắt mẫu", items: parseLines(manualSections.guiMau) },
      { num: "4", title: "Liên hệ khách hàng", items: parseLines(manualSections.lienHe) },
      { num: "5", title: sec5Title, items: parseLines(manualSections.sec5) },
    ];

    if (mode === "plan") {
      extraTodos.forEach((todo, idx) => {
        if (todo.title.trim() || todo.note.trim()) {
          const numStr = String(6 + idx);
          const t = todo.title.trim() || `Công việc #${numStr}`;
          const items = parseLines(todo.note);
          structuredSections.push({ num: numStr, title: t, items });
        }
      });
    }

    // Ghép text chuẩn hóa cho Telegram và Copy
    let compiled = `${currentCaption}\n\n`;
    structuredSections.forEach((s) => {
      compiled += `${s.num}. ${s.title}\n`;
      s.items.forEach((it) => {
        compiled += `${it}\n`;
      });
      compiled += `\n`;
    });
    compiled = compiled.trim();

    try {
      const res = await renderLiveImageApi({
        content: compiled,
        title: currentCaption,
        sections: structuredSections,
      });

      setFinalText(compiled);
      setPreviewImageUrl(res.image_data_url);
      setPreviewSource("manual");
      // Tự động chuyển sang xem ảnh trên giao diện mobile
      setMobileTab("preview");

      setStatusMessage({
        type: "success",
        text: `Đã tổng hợp ${structuredSections.length} mục và tạo ảnh Dark Mode thành công!`,
      });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail || err?.message || "Lỗi khi tạo ảnh từ các mục";
      setStatusMessage({ type: "error", text: String(errorMsg) });
    } finally {
      setIsRenderingManual(false);
    }
  };

  // 3. Hành động: "Gửi nội dung sang Telegram"
  const handleSendToTelegram = async () => {
    if (!finalText.trim()) {
      setStatusMessage({
        type: "error",
        text: "Chưa có nội dung báo cáo! Vui lòng bấm 'Tạo nội dung bằng AI' hoặc 'Tạo ảnh từ 5 mục' trước khi gửi.",
      });
      return;
    }

    setIsSendingTele(true);
    setStatusMessage(null);

    try {
      const res = await sendReportApi({
        mode,
        report_date: reportDate,
        summary_text: finalText,
        image_data_url: previewImageUrl || undefined,
      });

      if (res.message_id) {
        const sentData = {
          messageId: res.message_id,
          chatId: res.chat_id,
          caption: res.caption || currentCaption,
        };
        setLastSentMessage(sentData);
        try {
          localStorage.setItem("sale_tool_last_sent_msg", JSON.stringify(sentData));
        } catch {}
      }

      setStatusMessage({
        type: "success",
        text: `Đã gửi ảnh thành công vào Telegram kèm tiêu đề: "${res.caption}"!`,
      });
    } catch (err: any) {
      const errorMsg =
        err?.response?.data?.detail || err?.message || "Lỗi khi gửi sang Telegram";
      setStatusMessage({ type: "error", text: String(errorMsg) });
    } finally {
      setIsSendingTele(false);
    }
  };

  // 4. Hành động: "Xóa tin nhắn vừa gửi trên Telegram"
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
      try {
        localStorage.removeItem("sale_tool_last_sent_msg");
      } catch {}

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

  // Copy bản text cuối cùng
  const handleCopyFinalText = () => {
    if (!finalText) return;
    navigator.clipboard.writeText(finalText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Tải ảnh PNG về máy
  const handleDownloadImage = () => {
    if (!previewImageUrl) return;
    const a = document.createElement("a");
    a.href = previewImageUrl;
    a.download = `${currentCaption.replace(/[\/\s]/g, "_")}.png`;
    a.click();
  };

  // Xử lý chuyển đổi chế độ Kế hoạch <-> Báo cáo
  const handleSwitchMode = (newMode: ReportMode) => {
    setMode(newMode);
    if (newMode === "report") {
      setExtraTodos([]);
      // Ở chế độ Báo cáo: Tuyệt đối không có mục 6 trở lên
      if (finalText.trim()) {
        const lines = finalText.split("\n");
        const cleaned: string[] = [];
        let skippingExtra = false;
        for (const line of lines) {
          const m = line.match(/^(\d+)[\.\:]/);
          if (m && parseInt(m[1], 10) >= 6) {
            skippingExtra = true;
            continue;
          }
          if (m && parseInt(m[1], 10) <= 5) {
            skippingExtra = false;
          }
          if (!skippingExtra) {
            cleaned.push(line);
          }
        }
        const cleanedText = cleaned.join("\n").trim();
        setFinalText(cleanedText);
        if (cleanedText) {
          renderLiveImageApi({
            content: cleanedText,
            title: getShortCaption("report", reportDate),
          })
            .then((res) => setPreviewImageUrl(res.image_data_url))
            .catch(() => {});
        }
      }
    } else {
      if (finalText.trim()) {
        renderLiveImageApi({
          content: finalText,
          title: getShortCaption("plan", reportDate),
        })
          .then((res) => setPreviewImageUrl(res.image_data_url))
          .catch(() => {});
      }
    }
  };

  return (
    <div className="w-full flex flex-col lg:grid lg:grid-cols-12 gap-4 sm:gap-6 select-none">
      {/* MOBILE SEGMENTED CONTROL (< lg screens) */}
      <div className="lg:hidden flex items-center p-1 bg-[#12131A] rounded-2xl border border-white/[0.08] shadow-lg sticky top-[3.75rem] z-20 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setMobileTab("edit")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer",
            mobileTab === "edit"
              ? "bg-[#2563EB] text-white shadow-md shadow-blue-600/30"
              : "text-neutral-400 hover:text-white"
          )}
        >
          <PenLine className="h-3.5 w-3.5" />
          <span>1. Soạn thảo</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab("preview")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer relative",
            mobileTab === "preview"
              ? "bg-[#2563EB] text-white shadow-md shadow-blue-600/30"
              : "text-neutral-400 hover:text-white"
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          <span>2. Xem ảnh thẻ</span>
          {previewImageUrl && (
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
          )}
        </button>
      </div>

      {/* CỘT TRÁI: ĐIỀU KHIỂN & 2 PHƯƠNG THỨC NHẬP LIỆU (6 Cols) */}
      <div
        className={cn(
          "lg:col-span-6 flex flex-col gap-4 sm:gap-5",
          mobileTab === "preview" ? "hidden lg:flex" : "flex"
        )}
      >
        <div className="rounded-2xl border border-white/[0.08] bg-[#12131A] p-3.5 sm:p-5 shadow-xl flex flex-col gap-4">
          {/* Header Card */}
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3 gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-[#3B82F6] to-[#8B5CF6] flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-white tracking-tight truncate">
                  Kế hoạch & Báo cáo chuẩn 5 mục
                </h2>
                <p className="text-[11px] text-neutral-400 truncate">
                  Chuẩn hóa tự động theo cấu trúc & xuất ảnh gửi Telegram
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleResetDraft}
              title="Xóa bản nháp để làm mới từ đầu"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium text-neutral-400 hover:text-rose-300 hover:bg-rose-500/10 border border-white/[0.08] hover:border-rose-500/30 transition-all cursor-pointer shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Làm mới</span>
            </button>
          </div>

          {/* Chọn Chế độ & Ngày tháng */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Chế độ */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-300">Chế độ:</label>
              <div className="grid grid-cols-2 p-1 bg-black/40 border border-white/[0.06] rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => handleSwitchMode("plan")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    mode === "plan"
                      ? "bg-[#2563EB] text-white shadow-md shadow-blue-600/30"
                      : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Kế hoạch</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchMode("report")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer",
                    mode === "report"
                      ? "bg-[#2563EB] text-white shadow-md shadow-blue-600/30"
                      : "text-neutral-400 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  <FileText className="h-3.5 w-3.5" />
                  <span>Báo cáo</span>
                </button>
              </div>
            </div>

            {/* Ngày tháng */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-neutral-300">Ngày báo cáo:</label>
              <input
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                style={{ colorScheme: "dark" }}
                className="w-full bg-black/30 border border-white/[0.08] rounded-xl px-3 py-2 text-sm sm:text-xs text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {/* Chọn Phương thức nhập: AI Tự động vs Tự điền 5 mục */}
          <div className="flex flex-col gap-1.5 pt-1">
            <label className="text-xs font-medium text-neutral-300">Phương thức nhập dữ liệu:</label>
            <div className="grid grid-cols-2 p-1 bg-black/50 border border-white/[0.08] rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setInputMethod("ai_auto")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-center",
                  inputMethod === "ai_auto"
                    ? "bg-white/[0.14] text-white shadow-sm border border-white/[0.12]"
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <Bot className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                <span className="sm:hidden">1. Tóm tắt AI</span>
                <span className="hidden sm:inline">1. Tóm tắt AI (Văn bản dài)</span>
              </button>

              <button
                type="button"
                onClick={() => setInputMethod("manual_5")}
                className={cn(
                  "flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-center",
                  inputMethod === "manual_5"
                    ? "bg-white/[0.14] text-white shadow-sm border border-white/[0.12]"
                    : "text-neutral-400 hover:text-neutral-200"
                )}
              >
                <ListPlus className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span className="sm:hidden">2. Tự nhập 5 ô</span>
                <span className="hidden sm:inline">2. Tự nhập 5 mục thủ công</span>
              </button>
            </div>
          </div>

          {/* ======================= PHƯƠNG THỨC 1: AI TỰ ĐỘNG ======================= */}
          {inputMethod === "ai_auto" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <PenLine className="h-3.5 w-3.5 text-blue-400" />
                    <span>Nội dung ghi chép thô (Không giới hạn độ dài):</span>
                  </label>
                  {initialTranscriptText && (
                    <button
                      type="button"
                      onClick={handlePasteTranscript}
                      className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                    >
                      <ClipboardPaste className="h-3 w-3" />
                      <span>Dán từ ghi âm</span>
                    </button>
                  )}
                </div>

                <textarea
                  rows={6}
                  value={rawInput}
                  onChange={(e) => setRawInput(e.target.value)}
                  placeholder={
                    mode === "plan"
                      ? "Dán hoặc gõ kế hoạch của bạn tại đây... (Hỗ trợ văn bản rất dài, biên bản cuộc họp, ghi chú tự do không hạn chế độ dài)"
                      : "Dán hoặc gõ nội dung cuộc gặp đối tác, giao dịch bán hàng, thỏa thuận sản phẩm, giá cả, tình trạng mẫu... (Hỗ trợ bản bóc băng âm thanh dài 1-2 tiếng)"
                  }
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl p-3 text-sm sm:text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-blue-500 resize-none transition-colors leading-relaxed"
                />
                <div className="flex justify-between items-center text-[10px] text-neutral-500">
                  <span>Hỗ trợ văn bản cực dài lên tới 100.000 từ với Gemini 3 Flash</span>
                  <span>{rawInput.length} ký tự</span>
                </div>
              </div>

              {/* Nút bấm AI */}
              <button
                type="button"
                onClick={handleGenerateByAi}
                disabled={isGeneratingAi || !rawInput.trim()}
                className="w-full py-3 sm:py-2.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingAi ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>
                      {mode === "plan"
                        ? "AI đang đọc hiểu và chuẩn hóa kế hoạch..."
                        : "AI đang đọc hiểu và chuẩn hóa 5 mục..."}
                    </span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    <span>
                      {mode === "plan"
                        ? "Tạo kế hoạch bằng AI"
                        : "Tạo nội dung bằng AI (Chuẩn hóa đúng 5 mục)"}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* ======================= PHƯƠNG THỨC 2: TỰ NHẬP CÁC MỤC ======================= */}
          {inputMethod === "manual_5" && (
            <div className="flex flex-col gap-3">
              <div className="text-[11px] text-neutral-400 bg-white/[0.03] p-2.5 rounded-xl border border-white/[0.06]">
                Nhập chi tiết từng mục dưới đây (dễ dàng <b>xuống dòng ghi chú như Notes</b>). Mục nào không có bạn có thể <b>để trống</b> hoặc gõ <b>0</b>.
              </div>

              {/* Mục 1: Chốt đơn */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-blue-400">1. Chốt đơn:</label>
                <textarea
                  rows={2}
                  value={manualSections.chotDon}
                  onChange={(e) => setManualSections({ ...manualSections, chotDon: e.target.value })}
                  placeholder={"Ví dụ:\n- 01 đơn vải mè 500m - Anh Tuấn (giá 32k)\n- 01 đơn kaki 200m - Chị Hoa"}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-sm sm:text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-neutral-500 placeholder:text-xs leading-relaxed resize-y"
                />
              </div>

              {/* Mục 2: Gặp mặt */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-purple-400">2. Gặp mặt:</label>
                <textarea
                  rows={2}
                  value={manualSections.gapMat}
                  onChange={(e) => setManualSections({ ...manualSections, gapMat: e.target.value })}
                  placeholder={"Ví dụ:\n- Chị Huyền-9900: Mang vải kaki sang duyệt mẫu\n- Anh Dũng: Trao đổi tiến độ"}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-sm sm:text-xs text-white focus:outline-none focus:border-purple-500 placeholder:text-neutral-500 placeholder:text-xs leading-relaxed resize-y"
                />
              </div>

              {/* Mục 3: Gửi mẫu, cắt mẫu */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-emerald-400">3. Gửi mẫu, cắt mẫu:</label>
                <textarea
                  rows={2}
                  value={manualSections.guiMau}
                  onChange={(e) => setManualSections({ ...manualSections, guiMau: e.target.value })}
                  placeholder={"Ví dụ:\n- Cắt mẫu kaki xanh gửi bưu điện\n- Soạn mẫu thun lạnh gửi khách tỉnh"}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-sm sm:text-xs text-white focus:outline-none focus:border-emerald-500 placeholder:text-neutral-500 placeholder:text-xs leading-relaxed resize-y"
                />
              </div>

              {/* Mục 4: Liên hệ khách hàng */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-amber-400">4. Liên hệ khách hàng:</label>
                <textarea
                  rows={2}
                  value={manualSections.lienHe}
                  onChange={(e) => setManualSections({ ...manualSections, lienHe: e.target.value })}
                  placeholder={"Ví dụ:\n- Hoàng Bùi-1566: Trao đổi về giá và hợp đồng\n- Chị Lan: Xin feedback mẫu"}
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-sm sm:text-xs text-white focus:outline-none focus:border-amber-500 placeholder:text-neutral-500 placeholder:text-xs leading-relaxed resize-y"
                />
              </div>

              {/* Mục 5: Đăng bài (ở Kế hoạch) hoặc Công việc tồn đọng (ở Báo cáo) */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-rose-400">
                  {mode === "plan" ? "5. Đăng bài:" : "5. Công việc tồn đọng:"}
                </label>
                <textarea
                  rows={2}
                  value={manualSections.sec5}
                  onChange={(e) => setManualSections({ ...manualSections, sec5: e.target.value })}
                  placeholder={
                    mode === "plan"
                      ? "Ví dụ:\n- Đăng 2 bài mẫu vải kate mới lên nhóm Zalo sỉ\n- 1 video TikTok xưởng may"
                      : "Ví dụ:\n- Anh Tuấn: Hợp đồng chưa ký duyệt\n- Đơn mẫu chưa nhận được thanh toán"
                  }
                  className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-sm sm:text-xs text-white focus:outline-none focus:border-rose-500 placeholder:text-neutral-500 placeholder:text-xs leading-relaxed resize-y"
                />
              </div>

              {/* DANH SÁCH CÔNG VIỆC BỔ SUNG (Chỉ ở chế độ Kế hoạch) */}
              {mode === "plan" && (
                <div className="flex flex-col gap-2.5 pt-1">
                  {extraTodos.map((todo, index) => {
                    const itemNum = 6 + index;
                    return (
                      <div
                        key={todo.id}
                        className="p-3 bg-white/[0.03] border border-blue-500/20 rounded-xl flex flex-col gap-2 relative animate-in fade-in duration-150"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-blue-400 flex items-center gap-1.5">
                            <span className="h-5 w-5 rounded bg-blue-500/20 text-blue-300 flex items-center justify-center text-[11px] font-bold">
                              {itemNum}
                            </span>
                            <span>Công việc bổ sung:</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveTodo(todo.id)}
                            className="text-neutral-500 hover:text-red-400 p-1 rounded transition-colors cursor-pointer"
                            title="Xóa công việc này"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <input
                          type="text"
                          value={todo.title}
                          onChange={(e) => handleUpdateTodo(todo.id, "title", e.target.value)}
                          placeholder={`Tiêu đề công việc #${itemNum} (vd: Kiểm tra kho vải, Thu công nợ...)`}
                          className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-sm sm:text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-neutral-500 placeholder:text-xs"
                        />

                        <textarea
                          rows={2}
                          value={todo.note}
                          onChange={(e) => handleUpdateTodo(todo.id, "note", e.target.value)}
                          placeholder="Ghi chú chi tiết cho công việc này (xuống dòng thoải mái như notes)..."
                          className="w-full bg-black/40 border border-white/[0.08] rounded-lg px-3 py-2 text-sm sm:text-xs text-white focus:outline-none focus:border-blue-500 placeholder:text-neutral-500 placeholder:text-xs leading-relaxed resize-y"
                        />
                      </div>
                    );
                  })}

                  {/* Nút + (Nét đứt) để thêm việc mới như to-do list */}
                  <button
                    type="button"
                    onClick={handleAddTodo}
                    className="w-full py-2.5 px-4 border-2 border-dashed border-white/20 hover:border-blue-500/50 hover:bg-blue-500/5 text-neutral-400 hover:text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer mt-0.5"
                  >
                    <Plus className="h-4 w-4 text-blue-400" />
                    <span>Thêm công việc mới (To-do list)</span>
                  </button>
                </div>
              )}

              {/* Nút Render tạo ảnh */}
              <button
                type="button"
                onClick={handleRenderFromManual}
                disabled={isRenderingManual}
                className="w-full py-3 sm:py-2.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer mt-1"
              >
                {isRenderingManual ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang render ảnh...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>
                      Tạo ảnh từ các mục này{" "}
                      {mode === "plan" && extraTodos.length > 0 ? `(${5 + extraTodos.length} mục)` : "(5 mục)"}
                    </span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* VĂN BẢN CHUẨN HÓA CUỐI CÙNG (DÙNG ĐỂ GỬI TELEGRAM) */}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-blue-400" />
                <span>Nội dung văn bản chuẩn bị gửi ({mode === "report" ? 5 : currentTotalSections} mục):</span>
              </label>
              <div className="flex items-center gap-2">
                {mode === "plan" && (
                  <button
                    type="button"
                    onClick={handleOpenAddSectionModal}
                    title="Mở popup thêm công việc mới vào văn bản và tự động cập nhật ảnh"
                    className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-300 hover:text-white bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 rounded-lg transition-all cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-blue-400" />
                    <span>Thêm mục #{nextSectionNum}</span>
                  </button>
                )}
                {finalText && (
                  <button
                    type="button"
                    onClick={handleCopyFinalText}
                    className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Đã copy</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy văn bản</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            <textarea
              rows={8}
              value={finalText}
              onChange={(e) => setFinalText(e.target.value)}
              placeholder="Văn bản chuẩn (do AI gen hoặc tự tạo) sẽ xuất hiện tại đây. Bạn có thể tự do gõ sửa, thêm dòng, chỉnh giá/số lượng trực tiếp tại đây..."
              className={cn(
                "w-full rounded-xl p-3 text-sm sm:text-xs font-sans resize-y transition-colors leading-relaxed border select-text focus:outline-none focus:border-blue-500",
                finalText
                  ? "bg-black/60 border-blue-500/40 text-neutral-100"
                  : "bg-black/20 border-white/[0.04] text-neutral-600 placeholder-neutral-600"
              )}
            />

            {finalText && (
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1 text-[11px]">
                <span className="text-neutral-400">
                  💡 Bạn có thể trực tiếp sửa văn bản ở trên, ảnh thẻ sẽ tự động cập nhật ngay.
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleUpdateImageFromFinalText}
                    disabled={isUpdatingImage}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-lg font-medium transition-all cursor-pointer shrink-0"
                  >
                    {isUpdatingImage ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Đang cập nhật ảnh...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                        <span>Cập nhật ảnh ngay</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Thông báo trạng thái */}
          {statusMessage && (
            <div
              className={cn(
                "flex items-center gap-2 p-3 rounded-xl text-xs font-medium border",
                statusMessage.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-red-500/10 border-red-500/30 text-red-300"
              )}
            >
              {statusMessage.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span className="flex-1">{statusMessage.text}</span>
            </div>
          )}

          {/* NÚT: Gửi nội dung sang Telegram */}
          <button
            type="button"
            onClick={handleSendToTelegram}
            disabled={isSendingTele || !finalText.trim()}
            className="w-full py-3.5 sm:py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-1"
          >
            {isSendingTele ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Đang gửi ảnh sang Telegram...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span className="truncate">Gửi nội dung sang Telegram (Kèm tin nhắn: {currentCaption})</span>
              </>
            )}
          </button>

          {/* NÚT: Xóa tin nhắn vừa gửi (gồm ảnh + tin nhắn) */}
          {lastSentMessage && (
            <button
              type="button"
              onClick={handleDeleteLastSentMessage}
              disabled={isDeletingMsg}
              className="w-full py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 mt-1"
            >
              {isDeletingMsg ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-400" />
                  <span>Đang xóa tin nhắn trên Telegram...</span>
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                  <span>Xóa tin nhắn vừa gửi ({lastSentMessage.caption})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* CỘT PHẢI: ẢNH XEM TRƯỚC (GIỮ CỐ ĐỊNH, KHÔNG BỊ TRÔI HOẶC RESET) (6 Cols) */}
      <div
        className={cn(
          "lg:col-span-6 flex flex-col gap-4 sm:gap-5",
          mobileTab === "edit" ? "hidden lg:flex" : "flex"
        )}
      >
        <div className="rounded-2xl border border-white/[0.08] bg-[#12131A] p-3.5 sm:p-5 shadow-xl flex flex-col gap-4 min-h-[360px] sm:min-h-[580px]">
          {/* Header Preview */}
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-semibold text-white uppercase tracking-wider">
                Ảnh báo cáo:
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {currentCaption}
              </span>
            </div>

            {/* Trạng thái ảnh & Nút tải */}
            <div className="flex items-center gap-2">
              {previewSource === "ai" && (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <Sparkles className="h-3 w-3" />
                  <span className="hidden sm:inline">Chuẩn hóa AI</span>
                </span>
              )}
              {previewSource === "manual" && (
                <span className="text-[10px] text-blue-400 flex items-center gap-1 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                  <Check className="h-3 w-3" />
                  <span className="hidden sm:inline">Từ 5 mục nhập</span>
                </span>
              )}

              {previewImageUrl && (
                <button
                  type="button"
                  onClick={handleDownloadImage}
                  className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2 py-1 rounded bg-white/[0.06] transition-colors cursor-pointer"
                  title="Tải ảnh về máy"
                >
                  <Download className="h-3 w-3" />
                  <span>Tải ảnh</span>
                </button>
              )}
            </div>
          </div>

          {/* Khu vực hiển thị ảnh */}
          <div className="flex-1 flex flex-col items-center justify-center">
            {previewImageUrl ? (
              <div className="w-full flex flex-col items-center justify-center p-1.5 sm:p-2 bg-black/80 rounded-xl border border-white/[0.08] overflow-hidden">
                <img
                  src={previewImageUrl}
                  alt="Xem trước ảnh báo cáo"
                  className="w-full max-w-full sm:max-w-[500px] h-auto rounded-lg shadow-2xl object-contain border border-neutral-800"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 p-8 sm:p-12 text-center border-2 border-dashed border-white/[0.06] rounded-xl w-full h-full min-h-[300px] sm:min-h-[420px]">
                <div className="h-12 w-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-neutral-500">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex flex-col gap-1 max-w-xs">
                  <p className="text-sm font-medium text-neutral-300">
                    Chưa có ảnh báo cáo
                  </p>
                  <p className="text-xs text-neutral-500">
                    Bấm <b>"Tạo nội dung bằng AI"</b> hoặc <b>"Tự nhập 5 mục thủ công"</b> rồi bấm tạo ảnh để xem trước thẻ Dark Mode tại đây.
                  </p>
                </div>
              </div>
            )}

            {/* Thanh thao tác nhanh ngay dưới ảnh báo cáo */}
            {previewImageUrl && (
              <div className="w-full flex flex-col gap-2.5 mt-4 pt-4 border-t border-white/[0.08]">
                {/* Nút gửi sang Telegram ngay tại tab xem ảnh */}
                <button
                  type="button"
                  onClick={handleSendToTelegram}
                  disabled={isSendingTele || !finalText.trim()}
                  className="w-full py-3.5 sm:py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSendingTele ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Đang gửi ảnh sang Telegram...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span className="truncate">Gửi ngay sang Telegram ({currentCaption})</span>
                    </>
                  )}
                </button>

                {/* NÚT: Xóa tin nhắn vừa gửi (gồm ảnh + tin nhắn) */}
                {lastSentMessage && (
                  <button
                    type="button"
                    onClick={handleDeleteLastSentMessage}
                    disabled={isDeletingMsg}
                    className="w-full py-2.5 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isDeletingMsg ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-400" />
                        <span>Đang xóa tin nhắn trên Telegram...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                        <span>Xóa tin nhắn vừa gửi ({lastSentMessage.caption})</span>
                      </>
                    )}
                  </button>
                )}

                {/* Hàng nút trên mobile: Quay lại sửa & Tải ảnh */}
                <div className="flex items-center justify-between gap-2 lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileTab("edit")}
                    className="flex-1 py-2.5 px-3 bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    <span>← Quay lại chỉnh sửa</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadImage}
                    className="py-2.5 px-4 bg-white/[0.06] hover:bg-white/[0.1] text-neutral-300 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Lưu ảnh</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* POP-UP MODAL THÊM ĐẦU VIỆC (MỤC 6, 7...) VÀO KẾ HOẠCH */}
      {isAddSectionModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsAddSectionModalOpen(false)}
        >
          <div
            className="relative w-full max-w-lg bg-[#141622] border border-blue-500/30 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4 text-left select-text"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                  <PlusCircle className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    Thêm công việc #{nextSectionNum} vào kế hoạch
                  </h3>
                  <p className="text-[11px] text-neutral-400">
                    Tự động thêm vào ô văn bản & cập nhật lại ảnh xem trước ngay lập tức
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
              {/* Tiêu đề mục */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-200">
                  Tiêu đề mục #{nextSectionNum}:
                </label>
                <input
                  type="text"
                  value={modalTodoTitle}
                  onChange={(e) => setModalTodoTitle(e.target.value)}
                  placeholder="Ví dụ: Đăng bài nhóm sỉ Zalo, Kiểm kho xuất hàng, Thu công nợ..."
                  autoFocus
                  className="w-full bg-black/50 border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder:text-neutral-500"
                />
              </div>

              {/* Chi tiết công việc / Ghi chú */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-neutral-200">
                  Nội dung chi tiết / Ghi chú (xuống dòng như Notes):
                </label>
                <textarea
                  rows={4}
                  value={modalTodoNote}
                  onChange={(e) => setModalTodoNote(e.target.value)}
                  placeholder={"Ví dụ:\n- Đăng bài vào 3 nhóm sỉ Zalo đầu giờ sáng\n- Cập nhật bảng giá vải đũi mới\n- Gửi phản hồi cho anh Nam"}
                  className="w-full bg-black/50 border border-white/[0.12] rounded-xl p-3.5 text-sm text-white focus:outline-none focus:border-blue-500 placeholder:text-neutral-500 resize-y leading-relaxed"
                />
                <span className="text-[10px] text-neutral-500">
                  Mỗi dòng sẽ tự động biến thành 1 gạch đầu dòng (•) trong văn bản và thẻ ảnh.
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
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmittingModal ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Đang cập nhật ảnh...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Xác nhận & Cập nhật ảnh ngay</span>
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
