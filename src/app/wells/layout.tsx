import { Shell } from "@/components/shell";
import { getProfile } from "@/lib/data";

export default async function WellsLayout({ children }: LayoutProps<"/wells">) {
  const profile = await getProfile();
  return <Shell profile={profile}>{children}</Shell>;
}
