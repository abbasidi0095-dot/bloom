import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getFamilyContext } from "@/lib/family";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const context = await getFamilyContext(user.id);
  redirect(context.family ? "/dashboard" : "/onboarding");
}
