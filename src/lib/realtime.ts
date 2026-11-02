import { EventEmitter } from "node:events";
import { Client } from "pg";

type RealtimeEvent = { familyId: string; table: string; id: string; op: string };

const globalForRealtime = globalThis as unknown as {
  __bloomEvents?: EventEmitter;
  __bloomListener?: Client;
  __bloomConnecting?: boolean;
  __bloomRetry?: NodeJS.Timeout;
};

export const familyEvents =
  globalForRealtime.__bloomEvents ?? new EventEmitter();
familyEvents.setMaxListeners(200);
if (!globalForRealtime.__bloomEvents) globalForRealtime.__bloomEvents = familyEvents;

async function connect() {
  if (globalForRealtime.__bloomListener || globalForRealtime.__bloomConnecting) return;
  globalForRealtime.__bloomConnecting = true;
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    application_name: "bloom-realtime",
  });
  client.on("notification", (message) => {
    if (!message.payload) return;
    try {
      const payload = JSON.parse(message.payload) as RealtimeEvent;
      if (payload.familyId) familyEvents.emit("family", payload);
    } catch {
      // ignore malformed payloads
    }
  });
  client.on("error", () => {
    client.end().catch(() => {});
    globalForRealtime.__bloomListener = undefined;
    globalForRealtime.__bloomConnecting = false;
    scheduleReconnect();
  });
  client.on("end", () => {
    globalForRealtime.__bloomListener = undefined;
    globalForRealtime.__bloomConnecting = false;
    scheduleReconnect();
  });
  try {
    await client.connect();
    await client.query("listen bloom_events");
    globalForRealtime.__bloomListener = client;
  } catch {
    scheduleReconnect();
  } finally {
    globalForRealtime.__bloomConnecting = false;
  }
}

function scheduleReconnect() {
  if (globalForRealtime.__bloomRetry) return;
  globalForRealtime.__bloomRetry = setTimeout(() => {
    globalForRealtime.__bloomRetry = undefined;
    void connect();
  }, 2000);
}

export function ensureRealtime() {
  void connect();
}

export function onFamilyEvent(listener: (event: RealtimeEvent) => void) {
  familyEvents.on("family", listener);
  return () => familyEvents.off("family", listener);
}
