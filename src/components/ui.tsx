"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function PageHeader({
  kicker,
  title,
  subtitle,
  action,
}: {
  kicker?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {kicker ? <div className="section-title mb-2">{kicker}</div> : null}
        <h1 className="hero-title">{title}</h1>
        {subtitle ? <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">{subtitle}</p> : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="section-title">{children}</h2>
      {action}
    </div>
  );
}

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return <Tag className={`card ${className}`}>{children}</Tag>;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon ? <div className="empty-icon">{icon}</div> : null}
      <div>
        <p className="text-sm font-bold text-ink">{title}</p>
        {body ? <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted">{body}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "peach",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "peach" | "sage" | "lavender" | "sky" | "plain";
  icon?: ReactNode;
}) {
  const bg = {
    peach: "bg-peach-soft",
    sage: "bg-sage-soft",
    lavender: "bg-lavender-soft",
    sky: "bg-sky-soft",
    plain: "bg-surface",
  }[tone];
  return (
    <div className={`rounded-[22px] border border-line p-4 ${bg}`}>
      <div className="mb-2 flex items-center justify-between text-muted">
        <span className="text-[11px] font-bold uppercase tracking-[0.12em]">{label}</span>
        {icon}
      </div>
      <div className="stat-value tabular">{value}</div>
      {hint ? <div className="mt-1 text-[11px] text-muted">{hint}</div> : null}
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className = "",
}: {
  label?: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`field ${className}`}>
      {label ? (
        <label className="label" htmlFor={htmlFor}>
          {label}
        </label>
      ) : null}
      {children}
      {error ? <p className="field-error">{error}</p> : null}
      {hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  size = "default",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "default" | "wide";
}) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        style={size === "wide" ? { maxWidth: 680 } : undefined}
      >
        <div className="sheet-handle" />
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-xl font-display">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-xs leading-relaxed text-muted">{subtitle}</p> : null}
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-6 flex justify-end gap-2">{footer}</div> : null}
      </div>
    </>,
    document.body,
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className={`chip ${active ? "chip-active" : ""}`} onClick={onClick} aria-pressed={active}>
      {children}
    </button>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 flex-shrink-0 rounded-full border transition-colors ${
        checked ? "border-accent bg-accent" : "border-line bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow transition-all ${
          checked ? "start-[22px]" : "start-0.5"
        }`}
      />
    </button>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function LoadingCard() {
  return (
    <div className="card card-pad space-y-3">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-[18px] border border-line bg-peach-soft p-4 text-sm">
      <p className="font-semibold">{message}</p>
      {onRetry ? (
        <button type="button" className="btn btn-secondary btn-sm mt-3" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function Avatar({
  src,
  name,
  size = 44,
  className = "",
}: {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`grid place-items-center rounded-full bg-peach-soft font-display text-accent ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials || "B"}
    </div>
  );
}
