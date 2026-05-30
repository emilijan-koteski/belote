import { ArrowRight, Snowflake, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { CareerStreak } from "@/shared/api/career";

type StreakCalloutProps = {
  streak: CareerStreak;
};

/**
 * Win/loss streak banner between the hero and the stats grid. A win streak
 * reads as a warm felt-green callout; a cold streak as a neutral nudge back to
 * the lobby. Renders nothing when there is no active streak.
 */
export function StreakCallout({ streak }: StreakCalloutProps) {
  const { t } = useTranslation();

  if (streak.length === 0 || streak.kind === "none") return null;
  const isWin = streak.kind === "win";

  return (
    <div
      className="border-border mb-5 flex items-center gap-3.5 rounded-[var(--radius-lg)] border p-3.5"
      style={{
        background: isWin ? "var(--accent-soft)" : "var(--surface)",
        borderColor: isWin ? "rgba(25,101,54,0.33)" : "var(--border)",
      }}
      data-testid="profile-streak"
      data-streak-kind={streak.kind}
      data-streak-length={streak.length}
    >
      <span
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px]"
        style={{
          background: isWin ? "var(--accent)" : "var(--surface-3)",
          color: isWin ? "var(--accent-ink)" : "var(--ink)",
        }}
      >
        {isWin ? <Sparkles className="size-[18px]" /> : <Snowflake className="size-[18px]" />}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span
          className="font-display text-base font-semibold"
          style={{ color: isWin ? "var(--accent)" : "var(--ink)" }}
        >
          {isWin
            ? t("profile.streak.winTitle", { count: streak.length })
            : t("profile.streak.lossTitle", { count: streak.length })}
        </span>
        <span className="text-ink-dim text-xs">
          {isWin ? t("profile.streak.winSubtitle") : t("profile.streak.lossSubtitle")}
        </span>
      </div>
      <Link
        to="/lobby"
        className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] px-3.5 py-2 text-[13px] font-semibold"
        style={{
          background: isWin ? "var(--accent)" : "var(--ink)",
          color: isWin ? "var(--accent-ink)" : "var(--bg)",
        }}
        data-testid="profile-streak-play"
      >
        {t("profile.streak.play")}
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}
