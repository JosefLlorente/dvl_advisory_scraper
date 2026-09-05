"use client";

import { Button } from "@/components/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-lg font-semibold">Could not load advisories</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {error.message || "The outage list is temporarily unavailable."}
      </p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
