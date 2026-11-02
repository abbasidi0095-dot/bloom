"use client";

import { useEffect, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { apiFetch, ApiClientError, isOfflineError } from "@/lib/client";
import {
  enqueue,
  flushOutbox,
  pendingCount,
  readSnapshot,
  cacheSnapshot,
} from "@/lib/offline";

export type RecordRow = Record<string, any> & { id: string; recorded_by_name?: string };

async function fetchWithFallback<T>(key: string, url: string): Promise<T> {
  try {
    const data = await apiFetch<T>(url);
    void cacheSnapshot(key, data);
    return data;
  } catch (error) {
    if (isOfflineError(error)) {
      const cached = await readSnapshot<T>(key);
      if (cached) return cached;
    }
    throw error;
  }
}

export function useRecords(
  entity: string,
  params: { babyId?: string | null; from?: string; to?: string; search?: string; limit?: number; open?: boolean },
  enabled = true,
) {
  const query = new URLSearchParams();
  if (params.babyId) query.set("babyId", params.babyId);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.search) query.set("search", params.search);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.open) query.set("open", "true");
  const url = `/api/records/${entity}?${query.toString()}`;
  return useQuery({
    queryKey: ["records", entity, params],
    queryFn: () => fetchWithFallback<{ ok: true; records: RecordRow[] }>(`records:${entity}:${query.toString()}`, url),
    select: (data) => data.records,
    enabled: Boolean(params.babyId) && enabled,
    placeholderData: (previous) => previous,
  });
}

export function useTimeline(
  params: { babyId?: string | null; from?: string; to?: string; entity?: string; search?: string; limit?: number; order?: string },
  enabled = true,
) {
  const query = new URLSearchParams();
  if (params.babyId) query.set("babyId", params.babyId);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.entity && params.entity !== "all") query.set("entity", params.entity);
  if (params.search) query.set("search", params.search);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.order) query.set("order", params.order);
  const url = `/api/timeline?${query.toString()}`;
  return useQuery({
    queryKey: ["timeline", params],
    queryFn: () => fetchWithFallback<{ ok: true; entries: RecordRow[] }>(`timeline:${query.toString()}`, url),
    select: (data) => data.entries,
    enabled: Boolean(params.babyId) && enabled,
    placeholderData: (previous) => previous,
  });
}

export function useDashboard(params: { babyId?: string | null; date: string; tz: string }, enabled = true) {
  const query = new URLSearchParams();
  if (params.babyId) query.set("babyId", params.babyId);
  query.set("date", params.date);
  query.set("tz", params.tz);
  const url = `/api/dashboard?${query.toString()}`;
  return useQuery({
    queryKey: ["dashboard", params],
    queryFn: () => fetchWithFallback<any>(`dashboard:${query.toString()}`, url),
    enabled: Boolean(params.babyId) && enabled,
    refetchInterval: 60_000,
    placeholderData: (previous) => previous,
  });
}

export function useAnalytics(
  params: { babyId?: string | null; from: string; to: string; tz: string },
  enabled = true,
) {
  const query = new URLSearchParams();
  if (params.babyId) query.set("babyId", params.babyId);
  query.set("from", params.from);
  query.set("to", params.to);
  query.set("tz", params.tz);
  const url = `/api/analytics?${query.toString()}`;
  return useQuery({
    queryKey: ["analytics", params],
    queryFn: () => fetchWithFallback<any>(`analytics:${query.toString()}`, url),
    enabled: Boolean(params.babyId) && enabled,
    placeholderData: (previous) => previous,
  });
}

function invalidateAll(queryClient: ReturnType<typeof useQueryClient>, babyId?: string | null) {
  void queryClient.invalidateQueries({ queryKey: ["records"] });
  void queryClient.invalidateQueries({ queryKey: ["timeline"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  void queryClient.invalidateQueries({ queryKey: ["analytics"] });
  if (babyId) void queryClient.invalidateQueries({ queryKey: ["baby", babyId] });
}

export function useCreateRecord(entity: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { babyId: string } & Record<string, unknown>) => {
      // Generate the id before the request so a retry after an uncertain
      // network outcome can never create a duplicate record.
      const clientId = crypto.randomUUID();
      const payload = { ...input, id: clientId };
      try {
        const data = await apiFetch<{ ok: true; record: RecordRow }>(`/api/records/${entity}`, {
          method: "POST",
          json: payload,
        });
        return { offline: false, record: data.record };
      } catch (error) {
        if (isOfflineError(error)) {
          await enqueue({
            id: clientId,
            method: "POST",
            url: `/api/records/${entity}`,
            body: payload,
            entity,
            babyId: input.babyId,
          });
          return {
            offline: true,
            record: { ...input, id: clientId, _pending: true } as RecordRow,
          };
        }
        throw error;
      }
    },
    onSuccess: () => invalidateAll(queryClient, undefined),
  });
}

export function useUpdateRecord(entity: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; babyId: string; data: Record<string, unknown> }) => {
      try {
        const data = await apiFetch<{ ok: true; record: RecordRow }>(`/api/records/${entity}/${input.id}`, {
          method: "PATCH",
          json: input.data,
        });
        return { offline: false, record: data.record };
      } catch (error) {
        if (isOfflineError(error)) {
          await enqueue({
            id: input.id,
            method: "PATCH",
            url: `/api/records/${entity}/${input.id}`,
            body: input.data,
            entity,
            babyId: input.babyId,
          });
          return { offline: true, record: null };
        }
        throw error;
      }
    },
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useDeleteRecord(entity: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; babyId: string }) => {
      try {
        await apiFetch(`/api/records/${entity}/${input.id}`, { method: "DELETE" });
        return { offline: false };
      } catch (error) {
        if (isOfflineError(error)) {
          await enqueue({
            id: input.id,
            method: "DELETE",
            url: `/api/records/${entity}/${input.id}`,
            entity,
            babyId: input.babyId,
          });
          return { offline: true };
        }
        throw error;
      }
    },
    onSuccess: () => invalidateAll(queryClient),
  });
}

export function useOfflineStatus() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOnline(navigator.onLine);
    const refresh = () => {
      void pendingCount().then(setPending);
    };
    const goOnline = async () => {
      setOnline(true);
      window.dispatchEvent(new CustomEvent("bloom:online"));
      const result = await flushOutbox();
      refresh();
      if (result.sent > 0) {
        window.dispatchEvent(
          new CustomEvent("bloom:toast", {
            detail: { message: `${result.sent} offline ${result.sent === 1 ? "change" : "changes"} synced.`, tone: "success" },
          }),
        );
      }
    };
    const goOffline = () => setOnline(false);
    const onPending = () => refresh();
    refresh();
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    window.addEventListener("bloom:pending", onPending);
    const timer = setInterval(() => {
      if (navigator.onLine) void flushOutbox().then(refresh);
    }, 30_000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("bloom:pending", onPending);
      clearInterval(timer);
    };
  }, []);

  return { online, pending };
}

export function useRealtime(familyId: string | null | undefined) {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!familyId) return;
    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["timeline"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["analytics"] });
      void queryClient.invalidateQueries({ queryKey: ["records"] });
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
      window.dispatchEvent(new CustomEvent("bloom:family-change"));
    };

    const connect = () => {
      source = new EventSource(`/api/realtime?familyId=${encodeURIComponent(familyId)}`);
      // Catch anything that changed while the stream was connecting or reconnecting.
      source.addEventListener("ready", refresh);
      source.onopen = refresh;
      source.addEventListener("change", refresh);
      source.onerror = () => {
        source?.close();
        if (!closed) retry = setTimeout(connect, 4000);
      };
    };
    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, [familyId, queryClient]);
}

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiFetch<{ ok: true; notifications: RecordRow[] }>("/api/notifications"),
    select: (data) => data.notifications,
    refetchInterval: 60_000,
  });
}

export { ApiClientError, type QueryKey };
