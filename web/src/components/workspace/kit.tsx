import { useEffect, useRef, useState } from "react";
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Inbox, LoaderCircle, MoreHorizontal, X } from "lucide-react";

// Presentation-only building blocks for the workspace pages (Test Case
// Management, Scenarios, Generated Tests, Test History, Git, Agent Activity,
// Settings). Deliberately separate from components/ui/* so restyling these
// pages doesn't change Dashboard / Requirements / Code Analysis, which still
// use the original primitives.
//
// Design rules: one flat bordered container per block, 1px dividers instead
// of nested boxes, px-6 gutters, rounded-xl corners, translucent status pills.

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export type Tone = "neutral" | "primary" | "info" | "pass" | "fail" | "warn";

export const TONE: Record<Tone, { dot: string; text: string; soft: string; bar: string }> = {
  neutral: { dot: "bg-muted", text: "text-muted", soft: "bg-panel-2 text-muted border-border", bar: "bg-muted" },
  primary: { dot: "bg-primary", text: "text-primary", soft: "bg-primary/10 text-primary border-primary/20", bar: "bg-primary" },
  info: { dot: "bg-info", text: "text-info", soft: "bg-info/10 text-info border-info/20", bar: "bg-info" },
  pass: { dot: "bg-pass", text: "text-pass", soft: "bg-pass/10 text-pass border-pass/20", bar: "bg-pass" },
  fail: { dot: "bg-fail", text: "text-fail", soft: "bg-fail/10 text-fail border-fail/20", bar: "bg-fail" },
  warn: { dot: "bg-warn", text: "text-warn", soft: "bg-warn/10 text-warn border-warn/20", bar: "bg-warn" },
};

/* ------------------------------------------------------------------ */
/* Page scaffolding                                                    */
/* ------------------------------------------------------------------ */

export function PageShell({ children }: { children: ReactNode }) {
  return <div className="ws-page ws-theme min-h-full bg-bg text-text">{children}</div>;
}

/** Monospace, wide-tracked micro label - the system's signature eyebrow style. */
export const labelClass = "mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-muted";

/** Purple -> pink brand gradient used for active indicators, progress and primary CTAs. */
export const brandGradient = "bg-gradient-to-r from-primary to-accent";

export function LivePill({ title = "Auto-refreshing" }: { title?: string }) {
  return (
    <span title={title} className={cx(labelClass, "inline-flex items-center gap-2 rounded-full border border-pass/25 bg-pass/10 px-3 py-1.5 !text-pass")}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pass opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-pass" />
      </span>
      Live
    </span>
  );
}

export type Crumb = string | { label: string; to: string };

/** "● SECTION › PAGE" pill shown above page titles. */
export function Breadcrumb({ trail }: { trail: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className={cx(labelClass, "inline-flex max-w-full items-center gap-2 overflow-hidden rounded-full border border-border bg-panel/60 px-3.5 py-1.5 backdrop-blur")}>
      <span className={cx("h-1.5 w-1.5 shrink-0 rounded-full", brandGradient)} />
      {trail.map((c, i) => {
        const last = i === trail.length - 1;
        return (
          <span key={i} className="inline-flex min-w-0 items-center gap-2">
            {i > 0 && <ChevronRight className="h-3 w-3 shrink-0 opacity-60" />}
            {typeof c === "string" ? (
              <span className={cx("truncate", last && "text-text")}>{c}</span>
            ) : (
              <Link to={c.to} className="truncate transition-colors hover:text-primary">
                {c.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export function PageHeader({
  trail,
  title,
  subtitle,
  actions,
  live,
}: {
  trail?: Crumb[];
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  live?: boolean | string;
}) {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 pt-7 pb-7 sm:px-6 md:px-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          {trail && (
            <div className="mb-4">
              <Breadcrumb trail={trail} />
            </div>
          )}
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-text sm:text-[28px]">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-muted">{subtitle}</p>}
        </div>
        {(actions || live) && (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {live && <LivePill title={typeof live === "string" ? live : undefined} />}
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mx-auto w-full max-w-[1440px] space-y-6 px-4 py-7 sm:px-6 md:px-8", className)}>{children}</div>;
}

export function Surface({ className, interactive, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-border bg-panel/75 backdrop-blur-xl",
        // Soft lifted shadow in light mode; a hairline top highlight in dark mode.
        "shadow-[0_1px_2px_rgb(15_15_40/0.04),0_16px_40px_-20px_rgb(76_29_149/0.18)]",
        "[.dark_&]:shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04)]",
        interactive && "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40",
        className,
      )}
      {...props}
    />
  );
}

/** Card header. `eyebrow` renders as a mono micro label ("COMMITS · LOG"). */
export function SurfaceHeader({
  title,
  eyebrow,
  description,
  meta,
  actions,
  className,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-3 border-b border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow && <div className={cx(labelClass, "mb-1.5")}>{eyebrow}</div>}
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-semibold tracking-tight text-text">{title}</h2>
          {meta}
        </div>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

// Header + row share a grid template passed by the page (e.g.
// "xl:grid-cols-[...]"); below that breakpoint rows stack and the header hides.
export const tableHeadClass = cx("hidden items-center gap-4 border-b border-border px-6 py-3", labelClass);
export const tableRowClass = "flex flex-col gap-3 px-6 py-4 transition-colors hover:bg-panel-2/40";

/** Small label shown before a value only when a table row is stacked (mobile). */
export function CellLabel({ children, at = "xl" }: { children: ReactNode; at?: "lg" | "xl" }) {
  return <span className={cx(labelClass, "mr-2", at === "lg" ? "lg:hidden" : "xl:hidden")}>{children}</span>;
}

/** Mono meta strip closing a card: "28 FILES · 27 COMMITTED ............ HEAD 40E8725". */
export function TableFooter({ left, right }: { left: ReactNode; right?: ReactNode }) {
  return (
    <div className={cx(labelClass, "flex items-center justify-between gap-4 border-t border-border px-6 py-3.5")}>
      <span className="truncate">{left}</span>
      {right && <span className="shrink-0 truncate">{right}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPIs                                                                */
/* ------------------------------------------------------------------ */

export function KpiGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-px overflow-hidden rounded-2xl border border-border bg-border">{children}</div>;
}

export function Kpi({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className="min-w-[150px] flex-1 bg-panel px-6 py-5">
      <div className={cx(labelClass, "flex items-center gap-2")}>
        {tone && <span className={cx("h-1.5 w-1.5 rounded-full", TONE[tone].dot)} />}
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="truncate text-[28px] font-semibold leading-none tracking-[-0.02em] text-text tabular-nums">{value}</span>
        {hint && <span className="truncate text-xs text-muted">{hint}</span>}
      </div>
    </div>
  );
}

/** Width comes from className (e.g. "w-24"). `brand` paints the purple -> pink gradient. */
export function ProgressBar({ value, tone = "pass", brand, className }: { value: number; tone?: Tone; brand?: boolean; className?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className={cx("h-1.5 shrink-0 overflow-hidden rounded-full bg-panel-2", className)}>
      <div className={cx("h-full rounded-full transition-all duration-500", brand ? brandGradient : TONE[tone].bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status + chips                                                      */
/* ------------------------------------------------------------------ */

// green = done/passed, red = failed, amber = needs a human, blue = in flight.
const STATUS_TONE: Record<string, Tone> = {
  submitted: "neutral",
  analyzing: "info",
  planning: "info",
  generating_tests: "info",
  awaiting_scenario_approval: "warn",
  awaiting_plan_approval: "warn",
  awaiting_test_approval: "warn",
  committed: "pass",
  failed: "fail",
  ai_proposed: "warn",
  approved: "pass",
  rejected: "fail",
  grounding_in_progress: "info",
  grounded_pending_review: "warn",
  approved_for_generation: "pass",
  generating: "info",
  syntax_valid: "pass",
  syntax_invalid: "fail",
  pending_approval: "warn",
  queued: "neutral",
  running: "info",
  completed: "pass",
  cancelled: "neutral",
  passed: "pass",
  error: "fail",
  timedOut: "fail",
  skipped: "neutral",
  interrupted: "warn",
};

const IN_PROGRESS = new Set(["analyzing", "planning", "generating_tests", "grounding_in_progress", "generating", "running"]);

// Same wording as components/ui/StatusBadge so a status reads identically
// on every page.
const STATUS_LABELS: Record<string, string> = {
  syntax_valid: "validated",
  syntax_invalid: "validation failed",
};

export function statusTone(status: string): Tone {
  return STATUS_TONE[status] ?? "neutral";
}

/**
 * State glyph: filled check = done, spinning ring = in flight, filled x =
 * failed, hollow ring = waiting/neutral, ring + dot = needs a human.
 */
export function StatusGlyph({ tone, spinning, className }: { tone: Tone; spinning?: boolean; className?: string }) {
  const size = cx("h-3.5 w-3.5 shrink-0", className);
  if (spinning) return <span className={cx(size, "animate-spin rounded-full border-[1.5px] border-current border-t-transparent")} />;
  if (tone === "pass")
    return (
      <span className={cx(size, "flex items-center justify-center rounded-full bg-pass text-white")}>
        <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
      </span>
    );
  if (tone === "fail")
    return (
      <span className={cx(size, "flex items-center justify-center rounded-full bg-fail text-white")}>
        <X className="h-2.5 w-2.5" strokeWidth={3.5} />
      </span>
    );
  if (tone === "warn")
    return (
      <span className={cx(size, "flex items-center justify-center rounded-full border-[1.5px] border-current")}>
        <span className="h-1 w-1 rounded-full bg-current" />
      </span>
    );
  return <span className={cx(size, "rounded-full border-[1.5px] border-current opacity-70")} />;
}

export function StatusPill({ status, label }: { status: string; label?: string }) {
  const tone = statusTone(status);
  const text = label ?? STATUS_LABELS[status] ?? status.replace(/_/g, " ");
  return (
    <span
      className={cx(
        "mono inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border py-1 pl-1.5 pr-2.5 text-[10.5px] font-medium uppercase tracking-[0.1em]",
        TONE[tone].soft,
      )}
    >
      <StatusGlyph tone={tone} spinning={IN_PROGRESS.has(status)} />
      {text}
    </span>
  );
}

export function Chip({ children, tone, icon: Icon, className, title }: { children: ReactNode; tone?: Tone; icon?: LucideIcon; className?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-xs font-medium",
        tone ? cx("border", TONE[tone].soft) : "bg-panel-2 text-muted",
        className,
      )}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}

const PRIORITY_TONE: Record<string, Tone> = { critical: "fail", high: "warn", medium: "info", low: "neutral" };
const RISK_TONE: Record<string, Tone> = { high: "fail", medium: "warn", low: "pass" };

/** Coloured dot + plain label - quieter than a pill for secondary attributes. */
export function DotLabel({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-text">
      <span className={cx("h-2 w-2 rounded-full", TONE[tone].dot)} />
      {children}
    </span>
  );
}

export function PriorityLabel({ priority }: { priority: string }) {
  return (
    <DotLabel tone={PRIORITY_TONE[priority] ?? "neutral"}>
      <span className="capitalize">{priority}</span>
    </DotLabel>
  );
}

export function RiskLabel({ risk }: { risk: string }) {
  return (
    <DotLabel tone={RISK_TONE[risk] ?? "neutral"}>
      <span className="capitalize">{risk}</span>
    </DotLabel>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

type BtnVariant = "primary" | "secondary" | "ghost" | "danger";

const BTN_VARIANT: Record<BtnVariant, string> = {
  primary: "bg-gradient-to-r from-primary to-accent text-white shadow-lg shadow-primary/25 hover:shadow-primary/40 hover:brightness-110",
  secondary: "border border-border bg-panel text-text hover:bg-panel-2",
  ghost: "text-muted hover:bg-panel-2 hover:text-text",
  danger: "bg-fail text-white hover:brightness-110",
};

const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

export function Btn({
  variant = "secondary",
  size = "md",
  icon: Icon,
  iconClassName,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: "sm" | "md"; icon?: LucideIcon; iconClassName?: string }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-medium transition-all active:scale-[0.98]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        focusRing,
        size === "sm" ? "h-8 rounded-lg px-3 text-xs" : "h-10 rounded-xl px-4 text-sm",
        BTN_VARIANT[variant],
        className,
      )}
      {...props}
    >
      {Icon && <Icon className={cx(size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4", iconClassName)} />}
      {children}
    </button>
  );
}

/** Quiet square icon button for row actions; the label doubles as tooltip + aria-label. */
export function IconButton({
  icon: Icon,
  label,
  danger,
  positive,
  active,
  spinning,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: LucideIcon; label: string; danger?: boolean; positive?: boolean; active?: boolean; spinning?: boolean }) {
  return (
    <button
      type="button"
      title={props.title ?? label}
      aria-label={label}
      className={cx(
        "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        focusRing,
        active
          ? "bg-primary/10 text-primary"
          : danger
            ? "text-muted hover:bg-fail/10 hover:text-fail"
            : positive
              ? "text-pass hover:bg-pass/10"
              : "text-muted hover:bg-panel-2 hover:text-text",
        className,
      )}
      {...props}
    >
      <Icon className={cx("h-4 w-4", spinning && "animate-spin")} />
    </button>
  );
}

/** Link-styled button for inline row actions ("Approve", "Run again"). */
export function TextAction({
  icon: Icon,
  tone = "default",
  spinning,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon?: LucideIcon; tone?: "default" | "primary" | "danger"; spinning?: boolean }) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-sm font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-40",
        focusRing,
        tone === "primary" && "text-primary hover:bg-primary/10",
        tone === "danger" && "text-muted hover:bg-fail/10 hover:text-fail",
        tone === "default" && "text-muted hover:bg-panel-2 hover:text-text",
        className,
      )}
      {...props}
    >
      {Icon && <Icon className={cx("h-3.5 w-3.5", spinning && "animate-spin")} />}
      {children}
    </button>
  );
}

/** "More actions" overflow menu for rows that need more than 2-3 actions. */
export function ActionMenu({ label = "More actions", items }: { label?: string; items: { label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <IconButton icon={MoreHorizontal} label={label} active={open} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} />
      {open && (
        <div role="menu" className="ws-rise absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-border bg-panel p-1 shadow-xl shadow-black/30">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-text transition-colors hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <item.icon className="h-4 w-4 text-muted" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const inputClass =
  "h-10 w-full rounded-xl border border-border bg-panel px-3.5 text-sm text-text placeholder:text-muted/70 transition-colors focus:border-primary/60 focus:outline-none focus:ring-2 focus:ring-primary/15";

export function TextInput({ icon: Icon, className, ...props }: InputHTMLAttributes<HTMLInputElement> & { icon?: LucideIcon }) {
  return (
    <div className={cx("relative", className)}>
      {Icon && <Icon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />}
      <input className={cx(inputClass, Icon && "pl-10")} {...props} />
    </div>
  );
}

export function SelectField({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cx("relative", className)}>
      <select className={cx(inputClass, "cursor-pointer appearance-none pr-9")} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

/** Underline tabs. Place inside a container that draws the bottom border. */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; count?: number; icon?: LucideIcon }[];
}) {
  return (
    <div role="tablist" className="-mb-px flex gap-6 overflow-x-auto">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cx(
              "relative inline-flex shrink-0 items-center gap-2 whitespace-nowrap pb-3.5 pt-1 text-sm font-medium transition-colors focus-visible:outline-none",
              active ? "text-text" : "text-muted hover:text-text",
            )}
          >
            {o.icon && <o.icon className={cx("h-4 w-4", active && "text-primary")} />}
            {o.label}
            {o.count != null && (
              <span className={cx("mono rounded-full px-2 py-px text-[11px] tabular-nums", active ? "bg-primary/10 text-primary" : "bg-panel-2 text-muted")}>{o.count}</span>
            )}
            <span
              aria-hidden
              className={cx("absolute inset-x-0 bottom-0 h-0.5 rounded-full transition-opacity", brandGradient, active ? "opacity-100" : "opacity-0")}
            />
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* States                                                              */
/* ------------------------------------------------------------------ */

export function EmptyState({ icon: Icon = Inbox, title, description, className }: { icon?: LucideIcon; title: string; description?: ReactNode; className?: string }) {
  return (
    <div className={cx("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-panel-2 text-muted">
        <Icon className="h-5 w-5" />
      </div>
      <div className="mt-4 text-sm font-medium text-text">{title}</div>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
    </div>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-muted">
      <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
      {label}
    </div>
  );
}

export function ErrorState({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-fail/20 bg-fail/5 px-4 py-3 text-sm text-fail">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 break-words">{children}</div>
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-2/5 animate-pulse rounded bg-panel-2" />
            <div className="h-3 w-1/4 animate-pulse rounded bg-panel-2" />
          </div>
          <div className="h-5 w-24 animate-pulse rounded-full bg-panel-2" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Dialog                                                              */
/* ------------------------------------------------------------------ */

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  size?: "md" | "lg";
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="ws-theme fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx("ws-rise w-full overflow-hidden rounded-xl border border-border bg-panel shadow-2xl", size === "lg" ? "max-w-3xl" : "max-w-md")}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-text">{title}</h3>
            {description && <p className="mt-1 break-all text-sm text-muted">{description}</p>}
          </div>
          <IconButton icon={X} label="Close" onClick={onClose} className="-mr-2 -mt-1" />
        </div>
        <div className="px-6 pb-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-border bg-panel-2/30 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function CodeViewer({ code, filename }: { code: string; filename?: string }) {
  const lines = code.split("\n");
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[hsl(240_10%_6%)] text-[hsl(240_10%_92%)]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-2 text-xs text-white/50">
        <span className="mono truncate">{filename}</span>
        <span className="shrink-0 tabular-nums">{lines.length} lines</span>
      </div>
      <pre className="mono max-h-96 overflow-auto py-3 text-xs leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className="flex px-4 hover:bg-white/[0.03]">
            <span className="mr-4 w-8 shrink-0 select-none text-right text-white/25 tabular-nums">{i + 1}</span>
            <span className="whitespace-pre">{line || " "}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}

/** Definition-list item: small muted label above a value. */
export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <dt className={labelClass}>{label}</dt>
      <dd className="mt-1.5 text-sm text-text">{children}</dd>
    </div>
  );
}

const MONOGRAM_GRADIENTS = [
  "from-violet-500 to-fuchsia-500",
  "from-sky-500 to-indigo-500",
  "from-emerald-500 to-teal-500",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-500",
];

export function Monogram({ name, className }: { name: string; className?: string }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?";
  const hash = Array.from(name).reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  return (
    <div
      className={cx(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-semibold text-white",
        MONOGRAM_GRADIENTS[hash % MONOGRAM_GRADIENTS.length],
        className,
      )}
    >
      {initials}
    </div>
  );
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function elapsed(startIso: string, endIso: string | null): string | null {
  if (!endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}
