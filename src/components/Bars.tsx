/** Simple accessible bar chart for percentages (0-100). */
export function Bars({ values, labels, empty }: { values: number[]; labels?: string[]; empty: string }) {
  if (!values.length) return <p className="muted">{empty}</p>;
  return (
    <div className="chart" role="img" aria-label={values.map((v, i) => `${labels?.[i] ?? i + 1}: ${v}%`).join(', ')}>
      {values.map((v, i) => <div key={i} className="col1" title={`${labels?.[i] ?? ''} ${v}%`} style={{ height: `${Math.max(4, v)}%` }} />)}
    </div>
  );
}
