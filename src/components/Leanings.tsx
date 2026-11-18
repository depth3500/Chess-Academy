import type { Leaning } from '../data/leanings';

const ROWS: [keyof Leaning, string, string][] = [['pt', 'Positional', 'Tactical'], ['da', 'Defensive', 'Aggressive'], ['eb', 'Easy', 'Bookworm']];

/** Three scales with the centre marked: left is positional / defensive / easy, right is tactical / aggressive / bookworm. */
export function Leanings({ l, compact }: { l: Leaning; compact?: boolean }) {
  return (
    <div className={'lean' + (compact ? ' compact' : '')}>
      {ROWS.map(([k, a, b]) => {
        const v = l[k];
        return (
          <div className="lrow" key={k}>
            <span>{a}</span>
            <div className="ltrack" role="img" aria-label={`${a} to ${b}: ${v === 0 ? 'balanced' : v > 0 ? 'leans ' + b : 'leans ' + a}`}>
              <i className="mid" />
              <i className="fill" style={{ left: `${v >= 0 ? 50 : (v + 100) / 2}%`, width: `${Math.abs(v) / 2}%` }} />
              <i className="dot" style={{ left: `${(v + 100) / 2}%` }} />
            </div>
            <span>{b}</span>
          </div>
        );
      })}
    </div>
  );
}
