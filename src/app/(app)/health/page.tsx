import { Suspense } from "react";
import { HealthView } from "./health-view";

export const metadata = { title: "Health" };

export default function HealthPage() {
  return (
    <Suspense fallback={<div className="skeleton h-80" />}>
      <HealthView />
    </Suspense>
  );
}
