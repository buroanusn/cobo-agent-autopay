import { redirect } from "next/navigation";
import { DashboardClient } from "@/components/dashboard-client";
import { getCurrentUser } from "@/lib/auth/session";
import { getDashboardSnapshot } from "@/lib/domain/services";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return <DashboardClient initialSnapshot={await getDashboardSnapshot(user.id)} />;
}
