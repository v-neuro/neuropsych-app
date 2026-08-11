import React from "react";
import { cls } from "../lib/utils";

export function Card({ children, className }) {
  return (
    <div className={cls("rounded-2xl border border-indigo-100/90 bg-white/90 p-4 shadow-[0_8px_30px_rgba(30,64,175,0.08)] backdrop-blur-sm", className)}>
      {children}
    </div>
  );
}

function buttonClass({ variant = "secondary", size = "md", className } = {}) {
  if (size === "bare") return className;

  const variants = {
    primary: "bg-indigo-700 text-white border border-indigo-700 shadow-sm shadow-indigo-200 hover:bg-indigo-800 hover:border-indigo-800",
    secondary: "bg-white/90 text-indigo-950 border border-indigo-100 shadow-sm hover:bg-indigo-50 hover:border-indigo-200",
    subtle: "bg-indigo-50 text-indigo-900 border border-indigo-100 hover:bg-indigo-100 hover:border-indigo-200",
    warning: "bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 hover:border-amber-300",
    danger: "bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100 hover:border-rose-300",
    success: "bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300",
    info: "bg-sky-50 text-sky-900 border border-sky-200 hover:bg-sky-100 hover:border-sky-300",
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
        <div className="text-2xl font-semibold tracking-tight text-slate-900">{title}</div>
        {subtitle && <div className="text-sm text-slate-600">{subtitle}</div>}
      </div>
      {right && <div className="md:ml-auto">{right}</div>}
    </div>
  );
}

export function SectionTitle({ children }) {
  return <div className="text-sm font-semibold uppercase tracking-[0.12em] text-indigo-600">{children}</div>;
}
