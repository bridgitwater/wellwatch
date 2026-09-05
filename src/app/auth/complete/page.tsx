import { CompleteSignIn } from "./complete";

export default async function CompletePage({ searchParams }: PageProps<"/auth/complete">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" && sp.next.startsWith("/") ? sp.next : "/wells";
  return (
    <main className="flex-1 flex items-center justify-center px-5 py-12">
      <CompleteSignIn next={next} />
    </main>
  );
}
