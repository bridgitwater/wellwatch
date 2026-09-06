import Link from "next/link";

export default function WellNotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 py-16 text-center">
      <h1 className="text-2xl font-bold">We can&apos;t show that well</h1>
      <p className="text-ink-2 mt-2">
        Either the address is wrong or this well isn&apos;t linked to your account. If you funded it, write to{" "}
        <a className="underline" href="mailto:wellwatch@bridgitwater.org">wellwatch@bridgitwater.org</a>.
      </p>
      <Link href="/wells" className="inline-block mt-6 text-water font-semibold">Back to your wells</Link>
    </div>
  );
}
