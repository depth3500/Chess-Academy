/** Simple accessible bar chart for percentages (0-100), with optional labels under the bars. */
export function Bars({ values, labels, empty, show }: { values: number[]; labels?: string[]; empty: string; show?: boolean }) {
  if (!values.length) return <p className="muted">{empty}</p>;
  return (
    <div className={'chart' + (show ? ' labeled' : '')} role="img" aria-label={values.map((v, i) => `${labels?.[i] ?? i + 1}: ${v}%`).join(', ')}>
      {values.map((v, i) => (
        <div key={i} className="colw" title={`${labels?.[i] ?? ''} ${v}%`}>
          <div className="col1" style={{ height: `${Math.max(4, v)}%` }} />
          {show && <small>{labels?.[i]}</small>}
        </div>
      ))}
    </div>
  );
}
