import Link from "next/link";
import { CloudOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="card max-w-md p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-peach-soft text-accent">
          <CloudOff size={24} />
        </div>
        <h1 className="mt-5 text-2xl">You&apos;re offline</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Bloom keeps working while the connection is away. Entries you add are stored on this device and will sync
          automatically when you&apos;re back online.
        </p>
        <Link href="/dashboard" className="btn btn-primary mt-6 w-full">
          Open Bloom
        </Link>
      </div>
    </main>
  );
}
