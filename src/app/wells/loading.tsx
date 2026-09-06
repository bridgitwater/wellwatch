/** Skeleton for the wells list while its queries run. */
export default function WellsLoading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8" aria-busy="true" aria-label="Loading your wells">
      <div className="h-8 w-56 rounded bg-line/60 animate-pulse" />
      <div className="h-4 w-80 rounded bg-line/40 animate-pulse mt-3" />
      <ul className="grid gap-4 sm:grid-cols-2 mt-6">
        {[0, 1].map((i) => (
          <li key={i} className="rounded-xl border border-line bg-surface overflow-hidden">
            <div className="aspect-[16/9] bg-line/40 animate-pulse" />
            <div className="p-4">
              <div className="h-5 w-40 rounded bg-line/60 animate-pulse" />
              <div className="h-4 w-56 rounded bg-line/40 animate-pulse mt-2" />
              <div className="h-4 w-64 rounded bg-line/40 animate-pulse mt-4" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
