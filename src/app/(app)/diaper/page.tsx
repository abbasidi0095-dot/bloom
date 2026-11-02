import { Suspense } from "react";
import { DiaperView } from "./diaper-view";

export const metadata = { title: "Diapers" };

export default function DiaperPage() {
  return (
    <Suspense fallback={<div className="skeleton h-80" />}>
      <DiaperView />
    </Suspense>
  );
}
