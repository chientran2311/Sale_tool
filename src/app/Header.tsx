import { useEffect, useState } from "react";
import { Badge, Button } from "@/components/ui";
import { History, AudioWaveform } from "lucide-react";
import { apiClient } from "@/lib/api-client";

interface HeaderProps {
  onOpenHistory: () => void;
  recordCount?: number;
}

export function Header({ onOpenHistory, recordCount = 0 }: HeaderProps) {
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        await apiClient.get("/audio/records", { params: { limit: 1 } });
        if (isMounted) setIsBackendOnline(true);
      } catch {
        if (isMounted) setIsBackendOnline(false);
      }
    };

    checkHealth();
    const interval = window.setInterval(checkHealth, 15000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="h-14 sm:h-16 border-b border-white/[0.08] bg-[#090A0D]/90 backdrop-blur-md sticky top-0 z-30 px-3.5 sm:px-6 flex items-center justify-between">
      {/* Brand */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-[10px] bg-gradient-to-tr from-[#266DF0] to-[#9B69FF] flex items-center justify-center shadow-[0_0_16px_rgba(38,109,240,0.35)] shrink-0">
          <AudioWaveform className="h-4.5 w-4.5 sm:h-5 sm:w-5 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-semibold text-[#F3F4F6] tracking-tight truncate">
              Attio Sales Voice AI
            </h1>
            <Badge variant="brand" className="hidden sm:inline-flex text-[10px]">
              PhoWhisper & DeepFilter
            </Badge>
          </div>
          <p className="text-[11px] text-[#9CA3AF] hidden sm:block truncate">
            Trí tuệ giọng nói & Phiên âm cuộc gọi Sales CRM
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Backend Status Dot (Thu gọn trên mobile) */}
        {isBackendOnline === true && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">FastAPI Live :8000</span>
            <span className="sm:hidden">Online</span>
          </span>
        )}
        {isBackendOnline === false && (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-medium shrink-0">
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            <span>Offline</span>
          </span>
        )}

        {/* History Drawer Button */}
        <Button variant="secondary" size="sm" onClick={onOpenHistory} className="px-2.5 sm:px-3 text-xs">
          <History className="h-4 w-4 text-[#9CA3AF]" />
          <span className="hidden sm:inline">Lịch sử</span>
          {recordCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 bg-[#266DF0]/20 text-[#60A5FA] rounded-full text-[10px] font-mono font-semibold">
              {recordCount}
            </span>
          )}
        </Button>
      </div>
    </header>
  );
}
