import React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "mint" | "brand" | "neutral" | "danger" | "blue";
  withDot?: boolean;
}

export function Badge({
  children,
  className,
  variant = "neutral",
  withDot = false,
  ...props
}: BadgeProps) {
  const variantClasses = {
    mint: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    brand: "bg-[#9B69FF]/10 text-[#C084FC] border-[#9B69FF]/25",
    blue: "bg-[#266DF0]/10 text-[#60A5FA] border-[#266DF0]/25",
    neutral: "bg-white/[0.06] text-[#9CA3AF] border-white/[0.08]",
    danger: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  const dotColors = {
    mint: "bg-emerald-400",
    brand: "bg-[#9B69FF]",
    blue: "bg-[#266DF0]",
    neutral: "bg-[#9CA3AF]",
    danger: "bg-red-400",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium rounded-full border select-none",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {withDot && (
        <span className="relative flex h-1.5 w-1.5">
          <span className={cn("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", dotColors[variant])} />
          <span className={cn("relative inline-flex rounded-full h-1.5 w-1.5", dotColors[variant])} />
        </span>
      )}
      {children}
    </span>
  );
}
