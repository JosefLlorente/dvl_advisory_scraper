import type { Metadata } from "next";

import { LegalShell } from "@/components/legal-shell";
import { MAINTAINER_NAME, SOCIALS } from "@/lib/socials";

export const metadata: Metadata = {
  title: "Contact · Davao Light Outages",
};

export default function ContactPage() {
  return (
    <LegalShell title="Contact">
      <p>
        This unofficial index is maintained by {MAINTAINER_NAME}. Use the links
        below to get in touch. This site is not a Davao Light hotline — for
        outage reports and official updates, use Davao Light’s own channels.
      </p>
      <ul className="space-y-2">
        {SOCIALS.map((social) => (
          <li key={social.href}>
            <a
              href={social.href}
              target="_blank"
              rel="noreferrer"
              className="font-medium hover:underline"
            >
              {social.label}
            </a>
            <span className="text-muted-foreground"> · {social.handle}</span>
          </li>
        ))}
      </ul>
    </LegalShell>
  );
}
