"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, Info, X } from "lucide-react";
import { I18nProvider } from "@/i18n/provider";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";

type ToastOptions = { tone?: "success" | "error" | "info"; action?: { label: string; onClick: () => void } };
type ToastItem = { id: number; message: string; tone: "success" | "error" | "info"; action?: ToastOptions["action"] };

const ToastContext = createContext<(message: string, options?: ToastOptions) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

function Toaster() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  useEffect(() => {
    const push = (event: Event) => {
      const detail = (
        event as CustomEvent<{ message: string; tone?: ToastItem["tone"]; action?: ToastItem["action"] }>
      ).detail;
      if (!detail?.message) return;
      const item = {
        id: ++counter.current,
        message: detail.message,
        tone: detail.tone ?? "success",
        action: detail.action,
      };
      setItems((prev) => [...prev, item]);
      window.setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== item.id)), 5200);
    };
    window.addEventListener("bloom:toast", push);
    window.addEventListener("bloom:toast-action", push);
    return () => {
      window.removeEventListener("bloom:toast", push);
      window.removeEventListener("bloom:toast-action", push);
    };
  }, []);

  if (!items.length) return null;
  return (
    <div className="toast-wrap" aria-live="polite" aria-atomic="true">
      {items.map((item) => (
        <div key={item.id} className="toast">
          {item.tone === "success" ? <Check size={16} /> : item.tone === "error" ? <X size={16} /> : <Info size={16} />}
          <span>{item.message}</span>
          {item.action ? (
            <button
              type="button"
              className="ms-2 rounded-full px-2 py-0.5 text-xs font-extrabold underline underline-offset-2"
              onClick={() => {
                item.action?.onClick();
                setItems((prev) => prev.filter((i) => i.id !== item.id));
              }}
            >
              {item.action.label}
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function Providers({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: true },
          mutations: { retry: 0 },
        },
      }),
  );

  const toast = useCallback((message: string, options?: ToastOptions) => {
    if (typeof window === "undefined") return;
    if (options?.action) {
      const item = { message, tone: options.tone ?? "success", action: options.action };
      window.dispatchEvent(new CustomEvent("bloom:toast-action", { detail: item }));
      return;
    }
    window.dispatchEvent(
      new CustomEvent("bloom:toast", { detail: { message, tone: options?.tone ?? "success" } }),
    );
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider locale={locale} dict={dict}>
        <ToastContext.Provider value={value}>
          {children}
          <Toaster />
        </ToastContext.Provider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
