import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "success" | "outline";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg hover:shadow-xl active:scale-95",
  secondary:
    "bg-slate-700 hover:bg-slate-600 text-slate-100 border border-slate-600 hover:border-slate-500",
  danger:
    "bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/50 hover:border-rose-500",
  ghost: "hover:bg-slate-800/50 text-slate-300 hover:text-slate-100",
  success:
    "bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg hover:shadow-xl active:scale-95",
  outline:
    "border border-indigo-500/50 hover:border-indigo-500 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-600/10",
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs font-medium",
  md: "px-4 py-2 text-sm font-semibold",
  lg: "px-6 py-3 text-base font-semibold",
};

export function ButtonModern({
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={`
        rounded-lg
        transition-all
        duration-200
        disabled:opacity-50
        disabled:cursor-not-allowed
        disabled:hover:scale-100
        outline-none
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
