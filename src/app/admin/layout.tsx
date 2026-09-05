import Link from "next/link";
import { Shell } from "@/components/shell";
import { requireAdmin } from "@/lib/admin/guard";

const NAV = [
  ["/admin", "Today"],
  ["/admin/wells", "Wells"],
  ["/admin/partners", "Partners"],
  ["/admin/import", "Import"],
] as const;

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireAdmin();
  return (
    <Shell profile={profile}>
      <div className="border-b border-line bg-surface">
        <nav className="mx-auto max-w-6xl px-5 flex gap-5 text-sm h-11 items-center overflow-x-auto">
          <span className="text-xs font-semibold uppercase tracking-wide text-clay mr-1">Admin</span>
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} className="text-ink-2 hover:text-ink whitespace-nowrap">{label}</Link>
          ))}
        </nav>
      </div>
      <div className="mx-auto max-w-6xl px-5 py-6">{children}</div>
    </Shell>
  );
}
