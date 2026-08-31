import type { HTMLAttributes } from "react";

type Status = "success" | "warning" | "critical" | "info" | "pending" | "submitted";
type Variant = "filled" | "soft" | "outline";

const statusConfig: Record<
  Status,
  Record<Variant, string>
> = {
  success: {
    filled: "bg-emerald-600 text-white",
    soft: "bg-emerald-600/20 text-emerald-300 border border-emerald-500/30",
    outline: "border border-emerald-500/50 text-emerald-400",
  },
  warning: {
    filled: "bg-amber-600 text-white",
    soft: "bg-amber-600/20 text-amber-300 border border-amber-500/30",
    outline: "border border-amber-500/50 text-amber-400",
  },
  critical: {
    filled: "bg-rose-600 text-white",
    soft: "bg-rose-600/20 text-rose-300 border border-rose-500/30",
    outline: "border border-rose-500/50 text-rose-400",
  },
  info: {
    filled: "bg-blue-600 text-white",
    soft: "bg-blue-600/20 text-blue-300 border border-blue-500/30",
    outline: "border border-blue-500/50 text-blue-400",
  },
  pending: {
    filled: "bg-amber-600 text-white",
    soft: "bg-amber-600/20 text-amber-300 border border-amber-500/30 animate-pulse-subtle",
    outline: "border border-amber-500/50 text-amber-400",
  },
  submitted: {
    filled: "bg-indigo-600 text-white",
    soft: "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30",
    outline: "border border-indigo-500/50 text-indigo-400",
  },
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  status: Status;
  variant?: Variant;
  icon?: React.ReactNode;
  dot?: boolean;
}

export function BadgeModern({
  status,
  variant = "soft",
  icon,
  dot = false,
  className = "",
  children,
  ...props
}: BadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`
        inline-flex
        items-center
        gap-1.5
        px-3
        py-1.5
        rounded-full
        text-xs
        font-semibold
        transition-all
        duration-200
        ${config[variant]}
        ${className}
      `}
      {...props}
    >
      {dot && (
        <span
          className={`
            w-1.5
            h-1.5
            rounded-full
            ${
              status === "success"
                ? "bg-emerald-400"
                : status === "warning"
                  ? "bg-amber-400"
                  : status === "critical"
                    ? "bg-rose-400"
                    : "bg-blue-400"
            }
          `}
        />
      )}
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
