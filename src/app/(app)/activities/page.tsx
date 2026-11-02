import { Suspense } from "react";
import { ActivitiesView } from "./activities-view";

export const metadata = { title: "Activities" };

export default function ActivitiesPage() {
  return (
    <Suspense fallback={<div className="skeleton h-80" />}>
      <ActivitiesView />
    </Suspense>
  );
}
