import { DashboardClient } from "@/components/dashboard-client";
import { getDashboardSnapshot } from "@/lib/domain/services";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  return <DashboardClient initialSnapshot={await getDashboardSnapshot()} />;
}
