/** Small form primitives for the admin. Plain, dense, consistent. */
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const field = "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm placeholder:text-ink-3";

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${className}`}>
      <span className="font-medium text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${field} ${props.className ?? ""}`} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${field} min-h-24 ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${field} ${props.className ?? ""}`} />;
}

export function Button({ variant = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const styles = {
    primary: "bg-water text-white hover:bg-water-deep",
    ghost: "border border-line text-ink-2 hover:text-ink hover:border-ink-3",
    danger: "text-clay hover:bg-clay-soft",
  }[variant];
  return <button {...props} className={`rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-60 transition-colors ${styles} ${props.className ?? ""}`} />;
}

export function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-line">
        <h2 className="font-bold">{title}</h2>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Notice({ result }: { result: { ok: true; message?: string } | { ok: false; error: string } | null }) {
  if (!result) return null;
  return result.ok ? (
    result.message ? <p className="text-sm text-ok">{result.message}</p> : null
  ) : (
    <p className="text-sm text-clay">{result.error}</p>
  );
}
