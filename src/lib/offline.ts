"use client";

import Dexie, { type Table } from "dexie";

export type OutboxItem = {
  seq?: number;
  id: string;
  method: "POST" | "PATCH" | "DELETE";
  url: string;
  body?: unknown;
  createdAt: number;
  entity?: string;
  babyId?: string;
};

type Snapshot = { key: string; value: unknown; updatedAt: number };

class BloomDB extends Dexie {
  outbox!: Table<OutboxItem, number>;
  snapshots!: Table<Snapshot, string>;
  constructor() {
    super("bloom-offline");
    this.version(1).stores({
      outbox: "++seq, id, createdAt",
      snapshots: "key, updatedAt",
    });
  }
}

let instance: BloomDB | null = null;
export function offlineDb() {
  if (typeof window === "undefined") return null;
  if (!instance) instance = new BloomDB();
  return instance;
}

export async function enqueue(item: Omit<OutboxItem, "seq" | "createdAt">) {
  const db = offlineDb();
  if (!db) return;
  await db.outbox.add({ ...item, createdAt: Date.now() });
  window.dispatchEvent(new CustomEvent("bloom:pending"));
}

export async function pendingCount() {
  const db = offlineDb();
  if (!db) return 0;
  return db.outbox.count();
}

export async function flushOutbox() {
  const db = offlineDb();
  if (!db) return { sent: 0, failed: 0 };
  const items = await db.outbox.orderBy("createdAt").toArray();
  let sent = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: item.body !== undefined ? JSON.stringify(item.body) : undefined,
        credentials: "same-origin",
      });
      if (response.ok || response.status === 409 || response.status === 404) {
        await db.outbox.delete(item.seq!);
        sent += 1;
      } else if (response.status >= 400 && response.status < 500) {
        // Permanently rejected (validation or permission): drop to avoid a loop.
        await db.outbox.delete(item.seq!);
        failed += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
      break;
    }
  }
  window.dispatchEvent(new CustomEvent("bloom:pending"));
  return { sent, failed };
}

export async function cacheSnapshot(key: string, value: unknown) {
  const db = offlineDb();
  if (!db) return;
  await db.snapshots.put({ key, value, updatedAt: Date.now() });
}

export async function readSnapshot<T>(key: string): Promise<T | null> {
  const db = offlineDb();
  if (!db) return null;
  const row = await db.snapshots.get(key);
  return (row?.value as T) ?? null;
}
