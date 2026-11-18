import 'fake-indexeddb/auto';
import { del, get, set } from 'idb-keyval';
import { beforeEach, describe, expect, it } from 'vitest';
import { type Client, syncWith } from './cloud';

const rows = new Map<string, { value: unknown; updated_at: string }>();
let uid: string | null = 'u1';
const client: Client = {
  auth: { getSession: async () => ({ data: { session: uid ? { user: { id: uid } } : null } }) },
  from: () => ({
    select: async () => ({ data: [...rows.entries()].map(([key, r]) => ({ key, ...r })), error: null }),
    upsert: async (rs: unknown[]) => { for (const r of rs as { key: string; value: unknown; updated_at: string }[]) rows.set(r.key, { value: r.value, updated_at: r.updated_at }); return { error: null }; },
  }),
};

describe('cloud sync I/O (fake server)', () => {
  beforeEach(async () => { rows.clear(); uid = 'u1'; for (const k of ['openings', 'sessions', 'cards', 'meta', 'cloud-uid', 'reset', 'lessons', 'srs']) await del(k); });

  it('does nothing when signed out', async () => { uid = null; expect(await syncWith(client)).toBe(false); expect(rows.size).toBe(0); });
  it('pushes local edits, with their own timestamp', async () => {
    await set('openings', [{ id: 'a' }]); await set('meta', { openings: 1000 });
    await syncWith(client);
    expect(rows.get('openings')).toEqual({ value: [{ id: 'a' }], updated_at: new Date(1000).toISOString() });
  });
  it('a fresh device pulls the cloud copy and a newer cloud copy replaces an older local one', async () => {
    rows.set('openings', { value: [{ id: 'cloud' }], updated_at: new Date(2000).toISOString() });
    await syncWith(client);
    expect(await get('openings')).toEqual([{ id: 'cloud' }]);
    rows.set('openings', { value: [{ id: 'newer' }], updated_at: new Date(5000).toISOString() });
    await syncWith(client);
    expect(await get('openings')).toEqual([{ id: 'newer' }]);
    expect((await get('meta')).openings).toBe(5000);
  });
  it('merges progress from both sides', async () => {
    await set('sessions', [{ at: 1, opening: 'x' }]);
    rows.set('sessions', { value: [{ at: 2, opening: 'x' }], updated_at: new Date(2).toISOString() });
    await syncWith(client);
    expect((await get('sessions')).length).toBe(2);
    expect((rows.get('sessions')!.value as unknown[]).length).toBe(2);
  });
  it('another account never inherits the previous account\'s local data', async () => {
    await set('openings', [{ id: 'private-of-u0' }]); await set('meta', { openings: 9000 }); await set('cloud-uid', 'u0');
    await syncWith(client);
    expect(await get('openings')).toBeUndefined();
    expect(rows.size).toBe(0);
    expect(await get('cloud-uid')).toBe('u1');
  });
});
