import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "glass" | "elevated" | "ghost";
  interactive?: boolean;
}

const variantClasses: Record<string, string> = {
  default: "bg-panel border border-border hover:border-border-hover",
  glass:
    "bg-panel/70 backdrop-blur-xl border border-border hover:border-border-hover hover:bg-panel-2",
  elevated:
    "bg-panel border border-border shadow-xl hover:shadow-2xl hover:border-border-hover",
  ghost: "border border-border hover:border-border-hover hover:bg-panel-2",
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
