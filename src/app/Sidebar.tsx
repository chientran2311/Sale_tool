import { Headphones, Sparkles, BarChart3, Users, Settings, AudioWaveform } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  className?: string;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export function Sidebar({ className, activeTab = "voice", onTabChange }: SidebarProps) {
  const navItems = [
    { id: "voice", icon: Headphones, label: "Voice AI" },
    { id: "reports", icon: Sparkles, label: "Báo cáo AI" },
    { id: "analytics", icon: BarChart3, label: "Analytics" },
    { id: "crm", icon: Users, label: "Leads" },
    { id: "settings", icon: Settings, label: "Cài đặt" },
  ];

  return (
    <>
      {/* 1. Desktop Left Sidebar (Màn hình lớn >= 768px) */}
      <aside
        className={cn(
          "hidden md:flex w-16 border-r border-white/[0.08] bg-[#0E0F14] flex-col items-center py-5 justify-between select-none shrink-0",
          className
        )}
      >
        <div className="flex flex-col items-center gap-6">
          <div className="h-10 w-10 rounded-[10px] bg-white/[0.06] border border-white/[0.1] flex items-center justify-center text-[#266DF0]">
            <AudioWaveform className="h-5 w-5" />
          </div>

          <nav className="flex flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  title={item.label}
                  onClick={() => onTabChange?.(item.id)}
                  className={cn(
                    "h-10 w-10 rounded-[10px] flex items-center justify-center transition-all cursor-pointer relative group",
                    isActive
                      ? "bg-[#266DF0] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_2px_8px_rgba(38,109,240,0.3)]"
                      : "text-[#9CA3AF] hover:text-white hover:bg-white/[0.06]"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.id === "reports" && !isActive && (
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-[#9B69FF] to-[#266DF0] flex items-center justify-center text-xs font-semibold text-white">
          SC
        </div>
      </aside>

      {/* 2. Mobile Bottom Navigation Bar (Màn hình điện thoại < 768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0E0F14]/95 backdrop-blur-xl border-t border-white/[0.1] flex items-center justify-around px-1 z-50 select-none shadow-[0_-8px_24px_rgba(0,0,0,0.6)] pb-[env(safe-area-inset-bottom)] pt-1 h-[calc(4rem+env(safe-area-inset-bottom))]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange?.(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 py-1 px-1 rounded-xl transition-all cursor-pointer relative flex-1 max-w-[72px]",
                isActive
                  ? "text-[#3B82F6]"
                  : "text-[#9CA3AF] hover:text-white"
              )}
            >
              <div
                className={cn(
                  "h-7 w-7 rounded-lg flex items-center justify-center transition-all",
                  isActive ? "bg-[#3B82F6]/20 text-[#60A5FA]" : ""
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </div>
              <span className="text-[10px] font-medium tracking-tight leading-none truncate max-w-full">
                {item.label}
              </span>
              {item.id === "reports" && !isActive && (
                <span className="absolute top-1 right-2 sm:right-3 h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
