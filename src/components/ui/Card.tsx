import React from "react";
import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
}

export function Card({ children, className, interactive = false, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "bg-[#13141B] border border-white/[0.08] rounded-[12px] p-5 shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-all",
        interactive && "hover:bg-[#191B24] hover:border-white/[0.16] cursor-pointer",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
