import React from "react";
import { cls } from "../lib/utils";

export function Card({ children, className }) {
  return (
    <div className={cls("rounded-2xl border border-zinc-200 bg-white shadow-sm p-4 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-100", className)}>
      {children}
    </div>
  );
}

export function Header({ title, subtitle, right }) {
  return (
    <div className="mb-4 flex flex-col gap-1 md:flex-row md:items-center md:gap-3">
      <div>
        <div className="text-2xl font-semibold">{title}</div>
        {subtitle && <div className="text-sm text-zinc-600 dark:text-zinc-300">{subtitle}</div>}
      </div>
      {right && <div className="md:ml-auto">{right}</div>}
    </div>
  );
}

export function SectionTitle({ children }) {
  return <div className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-300">{children}</div>;
}
