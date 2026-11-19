/** Win-chance graph over the whole game (white's share is the lighter area). Click anywhere to jump to that move. */
export function EvalGraph({ wps, ply, onPick, marks }: { wps: number[]; ply: number; onPick: (p: number) => void; marks: { ply: number; color: string }[] }) {
  const n = Math.max(1, wps.length - 1), W = 600, H = 90;
  const x = (i: number) => (i / n) * W, y = (v: number) => H - (v / 100) * H;
  const pts = wps.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <svg className="graph" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Evaluation graph. Click to jump to a move."
      onClick={e => { const r = e.currentTarget.getBoundingClientRect(); onPick(Math.max(0, Math.min(n, Math.round(((e.clientX - r.left) / r.width) * n)))); }}>
      <rect width={W} height={H} className="g-bg" />
      <polygon points={`0,${H} ${pts} ${W},${H}`} className="g-area" />
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="g-mid" />
      {marks.map(m => <circle key={m.ply} cx={x(m.ply)} cy={y(wps[m.ply] ?? 50)} r="3" fill={m.color} />)}
      <line x1={x(ply)} x2={x(ply)} y1="0" y2={H} className="g-cur" />
    </svg>
  );
}
