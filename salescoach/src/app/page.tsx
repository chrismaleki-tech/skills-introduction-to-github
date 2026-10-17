import { redirect } from "next/navigation";
import { currentUser, isManagerRole } from "@/lib/session";

export default async function Home() {
  const user = await currentUser();
  redirect(isManagerRole(user.role) ? "/dashboard" : "/me");
}
