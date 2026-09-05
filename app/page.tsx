import { OutageDashboard } from "@/components/outage-dashboard";
import { getDashboardData } from "@/lib/advisories";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getDashboardData();
  return <OutageDashboard data={data} />;
}
