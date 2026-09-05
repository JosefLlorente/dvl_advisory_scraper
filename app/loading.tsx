import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <div className="border-b border-border px-4 py-3 md:px-6">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="mt-2 h-3 w-40" />
      </div>
      <div className="grid flex-1 lg:grid-cols-[1fr_28rem]">
        <Skeleton className="h-[45vh] rounded-none lg:h-full" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}
