// Pure sync logic: decides what to copy between this device and the cloud. No I/O, so it is easy to test.
export const KEYS = ['openings', 'sessions', 'lessons', 'cards', 'srs', 'reset', 'puzzles', 'favs'] as const;
export type Entry = { value: unknown; at: number };
export type Rec = Partial<Record<string, Entry>>;
type Stamped = { at: number; opening: string };
type CardLike = { last: number; seen: number };

/** Union of two session/lesson lists. Anything older than the last "reset progress" is dropped. */
export function mergeList(a: Stamped[], b: Stamped[], cut = 0) {
  const m = new Map<string, Stamped>();
  for (const x of [...a, ...b]) if (x.at >= cut) m.set(`${x.at}|${x.opening}`, x);
  return [...m.values()].sort((p, q) => p.at - q.at);
}

/** Per card, the most recently reviewed copy wins. */
export function mergeCards(a: Record<string, CardLike>, b: Record<string, CardLike>, cut = 0) {
  const out: Record<string, CardLike> = {};
  for (const src of [a, b]) {
    for (const [k, c] of Object.entries(src)) {
      const o = out[k];
      if (c.last >= cut && (!o || c.last > o.last || (c.last === o.last && c.seen > o.seen))) out[k] = c;
    }
  }
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Compares this device with the cloud. Sessions, lessons and card progress are merged (nothing is lost when two devices
 * both practised). Openings and the review schedule use "newest edit wins". Returns what to write locally and remotely.
 */
export function reconcile(local: Rec, remote: Rec) {
  const cut = Math.max(Number(local.reset?.value ?? 0), Number(remote.reset?.value ?? 0));
  const merged: Record<string, { empty: unknown; fn: (a: any, b: any) => unknown }> = {
    sessions: { empty: [], fn: (a, b) => mergeList(a, b, cut) },
    lessons: { empty: [], fn: (a, b) => mergeList(a, b, cut) },
    puzzles: { empty: [], fn: (a, b) => mergeList(a, b, cut) },
    cards: { empty: {}, fn: (a, b) => mergeCards(a, b, cut) },
    reset: { empty: 0, fn: (a, b) => Math.max(Number(a), Number(b)) },
  };
  const pull: Record<string, Entry> = {};
  const push: Record<string, Entry> = {};
  for (const k of KEYS) {
    const l = local[k], r = remote[k];
    if (!l && !r) continue;
    const m = merged[k];
    if (m) {
      const v = m.fn(l?.value ?? m.empty, r?.value ?? m.empty);
      const at = Math.max(l?.at ?? 0, r?.at ?? 0);
      if (!same(v, l?.value ?? m.empty)) pull[k] = { value: v, at };
      if (!same(v, r?.value ?? m.empty)) push[k] = { value: v, at };
    } else if (!r) push[k] = l!;
    else if (!l) pull[k] = r;
    else if (r.at > l.at) pull[k] = r;
    else if (l.at > r.at) push[k] = l;
  }
  return { pull, push };
}
