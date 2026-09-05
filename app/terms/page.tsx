import type { Metadata } from "next";

import { LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Terms · LightsOutinDVO",
};

export default function TermsPage() {
  return (
    <LegalShell title="Terms">
      <p className="text-xs text-muted-foreground">Last updated September 5, 2026</p>
      <p>
        This site is an unofficial index of public Davao Light interruption
        advisories. It is not affiliated with, endorsed by, or operated by Davao
        Light and Power Co., Inc.
      </p>
      <p>
        Times, areas, and status are parsed from source pages and may be late,
        incomplete, or wrong. Always confirm against the original advisory
        linked on each card before you rely on it.
      </p>
      <p>
        The map is a convenience view. Circle locations are approximate and do
        not mean every address inside a circle will lose power.
      </p>
      <p>
        Use the site at your own risk. The maintainer is not responsible for
        decisions made from this data.
      </p>
    </LegalShell>
  );
}
