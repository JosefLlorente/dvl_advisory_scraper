import type { Metadata } from "next";

import { LegalShell } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Privacy policy · Davao Light Outages",
};

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy policy">
      <p className="text-xs text-muted-foreground">Last updated September 5, 2026</p>
      <p>
        This site indexes publicly posted Davao Light service advisories and shows
        them on a map. It is an unofficial civic tool.
      </p>
      <p>
        We do not create user accounts, and the map does not ask for your name,
        email, or address.
      </p>
      <p>
        Outage records come from public Davao Light pages. Map tiles come from
        OpenStreetMap. Hosting and request logs may be stored by the service
        that runs this site.
      </p>
      <p>
        If you contact the maintainer, that message is used only to reply. We do
        not sell personal information.
      </p>
    </LegalShell>
  );
}
