import Link from "next/link";

import { SOCIALS } from "@/lib/socials";

const LINKS = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms" },
  { href: "/contact", label: "Contact" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <nav
          aria-label="Legal"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
        >
          {LINKS.map((link, index) => (
            <span key={link.href} className="inline-flex items-center gap-3">
              {index > 0 ? <span aria-hidden>·</span> : null}
              <Link href={link.href} className="hover:text-foreground">
                {link.label}
              </Link>
            </span>
          ))}
        </nav>
        <nav
          aria-label="Social"
          className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground"
        >
          {SOCIALS.map((social, index) => (
            <span key={social.href} className="inline-flex items-center gap-3">
              {index > 0 ? <span aria-hidden>·</span> : null}
              <a
                href={social.href}
                target="_blank"
                rel="noreferrer"
                className="hover:text-foreground"
              >
                {social.label}
              </a>
            </span>
          ))}
        </nav>
      </div>
    </footer>
  );
}
