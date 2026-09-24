import { cn } from "@/lib/utils";

export interface ProgressProps {
  value: number;
  className?: string;
  showLabel?: boolean;
}

export function Progress({ value, className, showLabel = false }: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      {showLabel && (
        <div className="flex justify-between text-xs text-[#9CA3AF] font-mono">
          <span>Tiến trình xử lý</span>
          <span>{clampedValue}%</span>
        </div>
      )}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#266DF0] to-[#9B69FF] transition-all duration-300 ease-out"
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}
