import { Shell } from "@/components/shell";
import { getProfile } from "@/lib/data";

/** Public example pages share the normal header/footer; signed-in visitors still see their nav. */
export default async function ExampleLayout({ children }: LayoutProps<"/example">) {
  const profile = await getProfile();
  return <Shell profile={profile}>{children}</Shell>;
}
