import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, TYPE_LABEL } from "@/lib/status";
import type { AdvisoryStatus, AdvisoryType } from "@/lib/types";

const STATUS_VARIANT = {
  upcoming: "upcoming",
  active: "active",
  completed: "completed",
  cancelled: "cancelled",
} as const;

export function StatusBadge({ status }: { status: AdvisoryStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function TypeBadge({ type }: { type: AdvisoryType }) {
  return <Badge variant="outline">{TYPE_LABEL[type]}</Badge>;
}
