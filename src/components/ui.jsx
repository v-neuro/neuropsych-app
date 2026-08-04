import React from "react";
import { cls } from "../lib/utils";

export function Card({ children, className }) {
  return (
    <div className={cls("rounded-2xl border border-zinc-200 bg-white shadow-sm p-4", className)}>
      {children}
    </div>
  );
}

function buttonClass({ variant = "secondary", size = "md", className } = {}) {
  const variants = {
    primary: "bg-zinc-900 text-white border border-zinc-900",
    secondary: "bg-white text-zinc-900 border border-zinc-300 hover:bg-zinc-50",
    subtle: "bg-zinc-50 text-zinc-900 border border-zinc-300 hover:bg-zinc-100",
    warning: "bg-amber-50 text-amber-700 border border-amber-200",
    danger: "bg-rose-50 text-rose-700 border border-rose-200",
    success: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    info: "bg-sky-50 text-sky-800 border border-sky-200",
  };
  const sizes = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-3 py-2 text-sm",
    lg: "px-4 py-2.5 text-base",
  };
  return cls(
    "inline-flex items-center justify-center rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed",
    variants[variant] || variants.secondary,
    sizes[size] || sizes.md,
    className
  );
}

export function Button({ variant = "secondary", size = "md", className, type = "button", children, ...props }) {
  return (
    <button type={type} className={buttonClass({ variant, size, className })} {...props}>
      {children}
    </button>
  );
}

export function Header({ title, subtitle, right }) {
  return (
    <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
      <div>
        <div className="text-2xl font-semibold">{title}</div>
        {subtitle && <div className="text-sm text-zinc-600">{subtitle}</div>}
      </div>
      {right && <div className="md:ml-auto">{right}</div>}
    </div>
  );
}

export function SectionTitle({ children }) {
  return <div className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{children}</div>;
}
