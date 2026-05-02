import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";

import type { MatchHandView, MatchListItem, MatchOutcome } from "@/shared/api/matches";
import { useUserMatchesInfiniteQuery } from "@/shared/hooks/queries/useMatches";
import type { TeamString } from "@/shared/types/gameTypes";

interface MatchHistoryProps {
  userId: number | undefined;
}

function formatDuration(
  startedAt: string,
  completedAt: string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "—";
  }
  const totalSec = Math.floor((end - start) / 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) {
    return t("profile.matchHistory.durationDhms", { d, h: pad(h), m: pad(m), s: pad(s) });
  }
  if (totalSec >= 3600) {
    return t("profile.matchHistory.durationHms", { h: pad(h), m: pad(m), s: pad(s) });
  }
  return t("profile.matchHistory.durationMs", { m: pad(m), s: pad(s) });
}

function formatDate(iso: string, lang: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }
  try {
    const locale = lang === "sr" ? "sr-Latn" : lang;
    return new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return iso;
  }
}

function OutcomeBadge({ outcome }: { outcome: MatchOutcome }) {
  const { t } = useTranslation();
  const classes: Record<MatchOutcome, string> = {
    win: "bg-success/20 text-success",
    loss: "bg-surface-elevated text-text-secondary",
    abandoned: "bg-warning/20 text-warning",
  };
  const labelKey: Record<MatchOutcome, string> = {
    win: "profile.matchHistory.outcomeWin",
    loss: "profile.matchHistory.outcomeLoss",
    abandoned: "profile.matchHistory.outcomeAbandoned",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes[outcome]}`}
      data-testid="match-history-outcome"
      data-outcome={outcome}
    >
      {t(labelKey[outcome])}
    </span>
  );
}

interface HandResultsTableProps {
  hands: MatchHandView[];
  viewerTeam: TeamString;
  viewerTeamIndex: 0 | 1;
}

function HandResultsTable({ hands, viewerTeam, viewerTeamIndex }: HandResultsTableProps) {
  const { t } = useTranslation();
  if (hands.length === 0) {
    return null;
  }

  // Order columns viewer-first: Us is always first, Them second.
  const usTeamString: TeamString = viewerTeam;
  const themTeamString: TeamString = viewerTeam === "teamA" ? "teamB" : "teamA";
  const usColorClass = viewerTeam === "teamA" ? "text-team-a" : "text-team-b";
  const themColorClass = viewerTeam === "teamA" ? "text-team-b" : "text-team-a";

  const usValue = (h: MatchHandView) => ({
    handTotal: viewerTeamIndex === 0 ? h.teamAHandTotal : h.teamBHandTotal,
    cardPoints: viewerTeamIndex === 0 ? h.teamACardPoints : h.teamBCardPoints,
    declPoints: viewerTeamIndex === 0 ? h.teamADeclPoints : h.teamBDeclPoints,
  });
  const themValue = (h: MatchHandView) => ({
    handTotal: viewerTeamIndex === 0 ? h.teamBHandTotal : h.teamAHandTotal,
    cardPoints: viewerTeamIndex === 0 ? h.teamBCardPoints : h.teamACardPoints,
    declPoints: viewerTeamIndex === 0 ? h.teamBDeclPoints : h.teamADeclPoints,
  });

  return (
    <table className="mt-3 w-full text-left text-sm" data-testid="match-history-hands-table">
      <thead className="text-xs text-text-secondary">
        <tr>
          <th className="py-1 pr-4 font-medium">#</th>
          <th className="py-1 pr-4 font-medium">
            <span className={usColorClass} data-team={usTeamString}>
              {t("team.us")}
            </span>
          </th>
          <th className="py-1 pr-4 font-medium">
            <span className={themColorClass} data-team={themTeamString}>
              {t("team.them")}
            </span>
          </th>
          <th className="py-1 pr-4 font-medium">{t("profile.matchHistory.hand.cardPoints")}</th>
          <th className="py-1 pr-4 font-medium">
            {t("profile.matchHistory.hand.declarationPoints")}
          </th>
          <th className="py-1 pr-4 font-medium">{t("profile.matchHistory.hand.handTotal")}</th>
          <th className="py-1 font-medium" />
        </tr>
      </thead>
      <tbody className="text-text-primary">
        {hands.map((h) => {
          const us = usValue(h);
          const them = themValue(h);
          // Failed-contract chip: contractingTeam compared to the viewer's
          // team index. If the viewer's team contracted (and failed), label
          // "Us"; otherwise "Them".
          const contractingIsUs = h.contractingTeam === viewerTeamIndex;
          const failedTeamLabel = contractingIsUs ? t("team.us") : t("team.them");
          const failedTeamString: TeamString = contractingIsUs ? usTeamString : themTeamString;
          const failedTeamColor = contractingIsUs ? usColorClass : themColorClass;
          // Last-trick chip color follows last-trick team viewer-relative.
          const lastTrickIsUs = h.lastTrickTeam === viewerTeamIndex;
          const lastTrickTeamString: TeamString = lastTrickIsUs ? usTeamString : themTeamString;
          const lastTrickColor = lastTrickIsUs ? usColorClass : themColorClass;
          return (
            <tr
              key={h.handNumber}
              className="border-t border-border"
              data-testid="match-history-hand-row"
              data-hand-number={h.handNumber}
            >
              <td className="py-1.5 pr-4 text-text-secondary">
                {t("profile.matchHistory.hand.number", { number: h.handNumber })}
              </td>
              <td className={`py-1.5 pr-4 ${usColorClass}`} data-team={usTeamString}>
                {us.handTotal}
              </td>
              <td className={`py-1.5 pr-4 ${themColorClass}`} data-team={themTeamString}>
                {them.handTotal}
              </td>
              <td className="py-1.5 pr-4 text-text-secondary">
                {us.cardPoints} / {them.cardPoints}
              </td>
              <td className="py-1.5 pr-4 text-text-secondary">
                {us.declPoints} / {them.declPoints}
              </td>
              <td className="py-1.5 pr-4 font-medium">
                {us.handTotal} – {them.handTotal}
              </td>
              <td className="py-1.5">
                <div className="flex flex-wrap gap-1.5">
                  {h.capot && (
                    <span
                      className="inline-flex items-center rounded bg-accent/20 px-1.5 py-0.5 text-xs font-medium text-accent"
                      data-testid="match-history-hand-capot"
                    >
                      +{h.capotBonus} {t("profile.matchHistory.hand.capot")}
                    </span>
                  )}
                  {!h.capot && h.lastTrickBonus > 0 && (
                    <span
                      className={`inline-flex items-center rounded bg-surface-elevated px-1.5 py-0.5 text-xs ${lastTrickColor}`}
                      data-testid="match-history-hand-last-trick"
                      data-team={lastTrickTeamString}
                    >
                      +{h.lastTrickBonus} {t("profile.matchHistory.hand.lastTrickBonus")}
                    </span>
                  )}
                  {h.failedContract && (
                    <span
                      className="inline-flex items-center gap-1 rounded bg-warning/20 px-1.5 py-0.5 text-xs font-medium text-warning"
                      data-testid="match-history-hand-failed"
                    >
                      <span>{t("profile.matchHistory.hand.failedContract")}</span>
                      <span
                        className={failedTeamColor}
                        data-testid="match-history-hand-failed-team"
                        data-team={failedTeamString}
                      >
                        {failedTeamLabel}
                      </span>
                    </span>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

interface MatchRowProps {
  match: MatchListItem;
  isOpen: boolean;
  onToggle: () => void;
}

function MatchRow({ match, isOpen, onToggle }: MatchRowProps) {
  const { t, i18n } = useTranslation();

  const teammateSeat = (match.viewerSeat + 2) % 4;
  const opp1Seat = (match.viewerSeat + 1) % 4;
  const opp2Seat = (match.viewerSeat + 3) % 4;
  const teammate = match.players.find((p) => p.seat === teammateSeat)?.username ?? "";
  const opponent1 = match.players.find((p) => p.seat === opp1Seat)?.username ?? "";
  const opponent2 = match.players.find((p) => p.seat === opp2Seat)?.username ?? "";

  // Viewer team — viewer always participated in their own match-history rows.
  const viewerTeamIndex: 0 | 1 = match.viewerSeat % 2 === 0 ? 0 : 1;
  const viewerTeam: TeamString = viewerTeamIndex === 0 ? "teamA" : "teamB";
  const usTeamString: TeamString = viewerTeam;
  const themTeamString: TeamString = viewerTeam === "teamA" ? "teamB" : "teamA";
  const usColorClass = viewerTeam === "teamA" ? "text-team-a" : "text-team-b";
  const themColorClass = viewerTeam === "teamA" ? "text-team-b" : "text-team-a";
  const usScore = viewerTeamIndex === 0 ? match.teamAScore : match.teamBScore;
  const themScore = viewerTeamIndex === 0 ? match.teamBScore : match.teamAScore;

  const variantKey = `profile.matchHistory.variant.${match.variant}`;
  const modeKey = `profile.matchHistory.mode.${match.matchMode}`;
  const variantLabel = i18n.exists(variantKey) ? t(variantKey) : match.variant;
  const modeLabel = i18n.exists(modeKey) ? t(modeKey) : match.matchMode;

  const detailId = `match-history-detail-${match.id}`;

  return (
    <li
      className="rounded-lg border border-border bg-surface p-4"
      data-testid="match-history-row"
      data-match-id={match.id}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-2 text-left"
        aria-expanded={isOpen}
        aria-controls={detailId}
        aria-label={
          isOpen ? t("profile.matchHistory.collapseRow") : t("profile.matchHistory.expandRow")
        }
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-sm text-text-secondary">
              {formatDate(match.completedAt, i18n.language)}
            </span>
            <span className="text-xs text-text-secondary">
              {variantLabel} {"·"} {modeLabel} {"·"}{" "}
              {formatDuration(match.startedAt, match.completedAt, t)}
            </span>
          </div>
          <OutcomeBadge outcome={match.outcome} />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-text-secondary">
              {t("profile.matchHistory.teammate")}
            </span>
            <span className="font-medium text-text-primary">{teammate}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-xs uppercase tracking-wide text-text-secondary">
              {t("profile.matchHistory.opponents")}
            </span>
            <span className="font-medium text-text-primary">
              {opponent1} {t("profile.matchHistory.vs")} {opponent2}
            </span>
          </div>
          <div className="ml-auto font-display text-lg font-semibold">
            <span className={usColorClass} data-team={usTeamString}>
              {usScore}
            </span>
            <span className="mx-2 text-text-secondary">{"–"}</span>
            <span className={themColorClass} data-team={themTeamString}>
              {themScore}
            </span>
          </div>
        </div>
      </button>

      {isOpen && (
        <div
          id={detailId}
          data-testid="match-history-detail"
          data-match-id={match.id}
          className="mt-3 border-t border-border pt-3"
        >
          <HandResultsTable
            hands={match.hands}
            viewerTeam={viewerTeam}
            viewerTeamIndex={viewerTeamIndex}
          />
        </div>
      )}
    </li>
  );
}

export function MatchHistory({ userId }: MatchHistoryProps) {
  const { t } = useTranslation();
  const query = useUserMatchesInfiniteQuery(userId);
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());

  const items = useMemo<MatchListItem[]>(() => {
    if (!query.data) return [];
    return query.data.pages.flatMap((p) => p.items);
  }, [query.data]);

  if (query.isPending) {
    return (
      <div className="space-y-2" data-testid="match-history-loading">
        <div className="h-16 animate-pulse rounded-lg bg-surface" />
        <div className="h-16 animate-pulse rounded-lg bg-surface" />
        <div className="h-16 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <p className="text-sm text-destructive" data-testid="match-history-error">
        {t("profile.matchHistory.error")}
      </p>
    );
  }

  const total = query.data?.pages[0]?.total ?? 0;

  if (total === 0) {
    return (
      <div data-testid="match-history-empty" className="space-y-3 text-sm text-text-secondary">
        <p>{t("profile.matchHistory.empty")}</p>
        <Link
          to="/lobby"
          className="inline-flex items-center text-accent underline underline-offset-2 hover:text-accent-foreground"
          data-testid="match-history-empty-cta"
        >
          {t("profile.matchHistory.emptyCta")}
        </Link>
      </div>
    );
  }

  const toggleOpen = (id: number) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const showLoadMore = items.length < total;

  return (
    <div className="space-y-3" data-testid="match-history">
      <ul className="space-y-2" data-testid="match-history-list">
        {items.map((match) => (
          <MatchRow
            key={match.id}
            match={match}
            isOpen={openIds.has(match.id)}
            onToggle={() => toggleOpen(match.id)}
          />
        ))}
      </ul>

      {showLoadMore && (
        <button
          type="button"
          onClick={() => query.fetchNextPage()}
          disabled={query.isFetchingNextPage}
          className="w-full rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text-primary transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="match-history-load-more"
        >
          {query.isFetchingNextPage
            ? t("profile.matchHistory.loading")
            : t("profile.matchHistory.loadMore")}
        </button>
      )}
    </div>
  );
}
