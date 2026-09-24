import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  color?: "blue" | "purple";
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  description,
  color = "blue",
}: SwitchProps) {
  const activeColor = color === "purple" ? "bg-[#9B69FF]" : "bg-[#266DF0]";

  return (
    <label className={cn("flex items-center justify-between gap-3 select-none cursor-pointer", disabled && "opacity-50 cursor-not-allowed")}>
      {(label || description) && (
        <div className="flex flex-col">
          {label && <span className="text-sm font-medium text-[#F3F4F6]">{label}</span>}
          {description && <span className="text-xs text-[#9CA3AF]">{description}</span>}
        </div>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onCheckedChange(!checked)}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-white/10 transition-colors duration-200 ease-in-out focus:outline-none",
          checked ? activeColor : "bg-white/10"
        )}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out mt-[1px]",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
    </label>
  );
}
