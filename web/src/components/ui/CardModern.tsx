import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "elevated" | "ghost";
  interactive?: boolean;
}

const variantClasses: Record<string, string> = {
  default: "bg-slate-800 border border-slate-700 hover:border-slate-600",
  glass:
    "bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-800/60",
  elevated:
    "bg-slate-800 border border-slate-700 shadow-xl hover:shadow-2xl hover:border-slate-600",
  ghost: "border border-slate-700/50 hover:border-slate-600 hover:bg-slate-800/30",
};

export function CardModern({
  variant = "default",
  interactive = false,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={`
        rounded-xl
        transition-all
        duration-300
        ${variantClasses[variant]}
        ${interactive ? "hover:shadow-lg cursor-pointer" : ""}
        ${className}
      `}
      {...props}
    />
  );
}
