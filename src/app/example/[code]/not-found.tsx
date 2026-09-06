import Link from "next/link";

export default function ExampleNotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16 text-center">
      <h1 className="text-2xl font-bold">This example isn&apos;t available</h1>
      <p className="text-ink-2 mt-2">The link may be old, or this well isn&apos;t published as a public example.</p>
      <a href="https://bridgitwater.org" className="inline-block mt-6 text-water font-semibold">Visit bridgitwater.org</a>
      <span className="text-ink-3 mx-2">·</span>
      <Link href="/login" className="inline-block mt-6 text-water font-semibold">Funder sign in</Link>
    </div>
  );
}
