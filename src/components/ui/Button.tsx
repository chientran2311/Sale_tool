import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "brand";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export function Button({
  children,
  className,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  ...props
}: ButtonProps) {
  const baseClasses =
    "inline-flex items-center justify-center gap-2 font-medium transition-all select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer";

  const sizeClasses = {
    sm: "text-xs px-2.5 py-1.5 rounded-[8px]",
    md: "text-sm px-3.5 py-2 rounded-[10px]",
    lg: "text-base px-5 py-2.5 rounded-[10px]",
    icon: "h-9 w-9 p-0 rounded-[10px]",
  };

  const variantClasses = {
    primary:
      "bg-[#266DF0] text-white hover:bg-[#1B57C4] active:scale-[0.98] border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.3)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_8px_rgba(38,109,240,0.3)]",
    secondary:
      "bg-white/[0.05] text-[#F3F4F6] hover:bg-white/[0.09] active:scale-[0.98] border border-white/[0.08] hover:border-white/[0.16]",
    ghost:
      "bg-transparent text-[#9CA3AF] hover:text-[#F3F4F6] hover:bg-white/[0.06] active:scale-[0.98]",
    danger:
      "bg-red-500/10 text-red-400 hover:bg-red-500/20 active:scale-[0.98] border border-red-500/20",
    brand:
      "bg-[#9B69FF] text-white hover:bg-[#864DF0] active:scale-[0.98] border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_1px_2px_rgba(0,0,0,0.3)] hover:shadow-[0_0_16px_rgba(155,105,255,0.35)]",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={cn(baseClasses, sizeClasses[size], variantClasses[variant], className)}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
