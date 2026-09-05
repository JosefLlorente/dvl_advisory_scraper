import type { ReactNode } from "react";
import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";

export function LegalShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight hover:text-foreground"
          >
            <img
              src="/dvo_scraper.png"
              alt=""
              width={24}
              height={24}
              className="size-6 rounded-full object-cover"
            />
            LightsOutinDVO
          </Link>
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
            Back to map
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 md:px-6">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <div className="mt-4 space-y-4 text-sm leading-relaxed text-foreground">
          {children}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
