import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import { BrandLockup } from "@/features/landing/components/BrandLockup";
import { ContactDialog } from "@/features/landing/components/ContactDialog";

// Felt footer — brand, a row of links, and the copyright. Rules + Leaderboard
// reach the public reference pages; Privacy + Terms the public legal pages;
// Contact opens a dialog.

export function LandingFooter() {
  const { t } = useTranslation();

  const links: Array<{ label: string; to: string }> = [
    { label: t("landing.foot.rules"), to: "/rules" },
    { label: t("landing.foot.leaderboard"), to: "/leaderboard" },
    { label: t("landing.foot.privacy"), to: "/privacy" },
    { label: t("landing.foot.terms"), to: "/terms" },
  ];

  return (
    <footer className="felt-surface border-brass-soft border-t py-10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-5 px-[clamp(28px,5vw,72px)]">
        <BrandLockup size={30} wordmarkSize={18} />
        <nav className="text-ink-mute ml-auto flex flex-wrap items-center gap-6 text-[13px]">
          {links.map((l) => (
            <Link key={l.label} to={l.to} className="hover:text-ink transition-colors">
              {l.label}
            </Link>
          ))}
          <ContactDialog />
        </nav>
        <span className="text-ink-off font-mono text-[11px]">{t("landing.foot.copyright")}</span>
      </div>
    </footer>
  );
}
