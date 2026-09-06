/** Skeleton for a well page while its queries run. */
export default function WellLoading() {
  return (
    <article className="mx-auto max-w-5xl px-5 py-6" aria-busy="true" aria-label="Loading well">
      <div className="h-4 w-32 rounded bg-line/40 animate-pulse" />
      <div className="h-9 w-72 rounded bg-line/60 animate-pulse mt-4" />
      <div className="h-4 w-96 max-w-full rounded bg-line/40 animate-pulse mt-2" />
      <div className="aspect-[16/7] rounded-xl bg-line/40 animate-pulse mt-6" />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px] mt-6">
        <div className="flex flex-col gap-6">
          <div className="h-40 rounded-xl border border-line bg-surface animate-pulse" />
          <div className="h-64 rounded-xl border border-line bg-surface animate-pulse" />
        </div>
        <div className="flex flex-col gap-6">
          <div className="h-48 rounded-xl border border-line bg-surface animate-pulse" />
          <div className="h-64 rounded-xl border border-line bg-surface animate-pulse" />
        </div>
      </div>
    </article>
  );
}
