import { redirect } from "next/navigation";
import { currentUser, isManagerRole } from "@/lib/session";
import { parseCustomization, START_PAGES } from "@/lib/customization";

export default async function Home() {
  const user = await currentUser();
  const customization = parseCustomization(user.org.customizationJson);

  // Vendor-provisioned start page, unless it points into a disabled module.
  const start = START_PAGES.find((p) => p.value === customization.startPage);
  if (start && start.value !== "default" && (!start.module || customization.modules[start.module])) {
    redirect(start.value);
  }
  redirect(isManagerRole(user.role) ? "/dashboard" : "/me");
}
