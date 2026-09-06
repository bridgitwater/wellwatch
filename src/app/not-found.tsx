import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center px-5 py-16">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">That page doesn&apos;t exist</h1>
        <p className="text-ink-2 mt-2">The link may be old or mistyped.</p>
        <Link href="/wells" className="inline-block mt-6 text-water font-semibold">Go to your wells</Link>
      </div>
    </main>
  );
}
