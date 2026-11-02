"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="card card-pad mx-auto max-w-lg text-center">
      <h1 className="text-2xl">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">
        We couldn&apos;t load this screen. Your records are safe — please try again.
      </p>
      <button type="button" className="btn btn-primary mt-5" onClick={reset}>
        <RefreshCw size={16} />
        Try again
      </button>
    </div>
  );
}
