/**
 * Static table chrome — wood rim, felt surface, dashed brass oval, filigree
 * corners. Pointer-events disabled so HUD/seats/chat layered above receive
 * clicks. Kept stateless and CSS-only so it costs nothing per frame.
 *
 * Tokens come from `.game-table` in index.css; this layer assumes the parent
 * already opted into the scope.
 */
export function TableBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="table-backdrop" aria-hidden>
      {/* Wood rim — 5-stop diagonal */}
      <div
        className="absolute rounded-3xl"
        style={{
          inset: 14,
          background:
            "linear-gradient(135deg, var(--wood-base) 0%, var(--wood-light) 20%, var(--wood-dark) 50%, var(--wood-light) 80%, var(--wood-base) 100%)",
          boxShadow:
            "inset 0 0 0 1px rgba(201,168,118,0.5), inset 0 0 30px rgba(0,0,0,0.6), 0 20px 60px rgba(0,0,0,0.7)",
        }}
      />
      {/* Felt surface — radial gradient + cross-hatch overlays */}
      <div
        className="absolute rounded-2xl"
        style={{
          inset: 36,
          background: `
            radial-gradient(ellipse at 50% 50%, var(--felt-light) 0%, var(--felt-dark) 70%, var(--felt-deep) 100%),
            repeating-linear-gradient(45deg, transparent 0 3px, rgba(0,0,0,0.04) 3px 4px),
            repeating-linear-gradient(-45deg, transparent 0 3px, rgba(255,255,255,0.015) 3px 4px)
          `,
          backgroundBlendMode: "normal, overlay, overlay",
          boxShadow: "inset 0 0 60px rgba(0,0,0,0.55), inset 0 0 200px rgba(0,0,0,0.25)",
        }}
      />
      {/* Brass oval boundary + filigree corners */}
      <svg
        className="absolute"
        style={{ inset: 36 }}
        viewBox="0 0 1368 828"
        preserveAspectRatio="none"
      >
        {/* Outer dashed oval */}
        <ellipse
          cx="684"
          cy="414"
          rx="540"
          ry="310"
          fill="none"
          stroke="rgba(201,168,118,0.28)"
          strokeWidth="2"
          strokeDasharray="3 6"
        />
        {/* Inner thin oval — inset 1.5% to read as a double rule */}
        <ellipse
          cx="684"
          cy="414"
          rx="531.9"
          ry="305.35"
          fill="none"
          stroke="rgba(201,168,118,0.18)"
          strokeWidth="1"
        />
        {/* Filigree corner glyphs at the four 'corners' of the oval */}
        {(
          [
            [150, 120, 0],
            [1218, 120, 90],
            [150, 708, 270],
            [1218, 708, 180],
          ] as const
        ).map(([x, y, rot], i) => (
          <g key={i} transform={`translate(${x}, ${y}) rotate(${rot})`} opacity="0.32">
            <path d="M0 0 Q 18 4, 22 22 Q 4 18, 0 0" fill="var(--brass)" />
          </g>
        ))}
      </svg>
    </div>
  );
}
