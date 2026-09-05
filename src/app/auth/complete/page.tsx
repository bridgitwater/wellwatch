import { CompleteSignIn } from "./complete";
import { safeNext } from "@/lib/safe-next";

export default async function CompletePage({ searchParams }: PageProps<"/auth/complete">) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  return (
    <main className="flex-1 flex items-center justify-center px-5 py-12">
      <CompleteSignIn next={next} />
    </main>
  );
}
