import { cn } from "@/shared/lib/utils";

type AvatarTeam = "A" | "B" | null;

type AvatarProps = {
  name: string;
  size?: number;
  team?: AvatarTeam;
  owner?: boolean;
  you?: boolean;
  className?: string;
};

/**
 * Initials-in-circle avatar used by seat tiles, roster dropdown, and chat
 * rows. Fill follows team colors when set; the ring color encodes role —
 * brass for owner, accent for "you", team color otherwise. Owner gets a soft
 * brass halo via box-shadow so they read at a glance across the diamond.
 */
export function Avatar({ name, size = 36, team = null, owner, you, className }: AvatarProps) {
  const initial = (name || "?").charAt(0).toUpperCase();

  let background: string;
  let textColor: string;
  if (team === "A") {
    background = "var(--team-a-fill)";
    textColor = "#3b2c08";
  } else if (team === "B") {
    background = "var(--team-b-fill)";
    textColor = "#2c2f35";
  } else {
    // Neutral / undetermined — felt-green. Used for standing members and for
    // everyone while the viewer is still unseated (no Us/Them perspective yet).
    background = "linear-gradient(135deg, #1c7a45 0%, var(--accent-deep) 100%)";
    textColor = "var(--accent-ink)";
  }

  let ringColor: string;
  if (owner) ringColor = "var(--brass)";
  else if (you) ringColor = "var(--accent)";
  else if (team === "A") ringColor = "var(--team-a)";
  else if (team === "B") ringColor = "var(--team-b)";
  else ringColor = "var(--border-2)";

  return (
    <div
      className={cn(
        "font-display inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        className,
      )}
      style={{
        width: size,
        height: size,
        background,
        color: textColor,
        border: `2px solid ${ringColor}`,
        fontSize: Math.max(11, size * 0.42),
        letterSpacing: -0.3,
        boxShadow: owner ? "0 0 0 3px rgba(201,168,118,0.20)" : "none",
      }}
      aria-hidden="true"
    >
      {initial}
    </div>
  );
}
