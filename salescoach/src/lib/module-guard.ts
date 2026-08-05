import { redirect } from "next/navigation";
import { currentUser } from "./session";
import { parseCustomization, type ModuleId } from "./customization";

/**
 * Section-layout guard: when the org has a module switched off, its routes
 * bounce to "/" (which honors the org's configured start page).
 */
export async function requireModule(module: ModuleId) {
  const user = await currentUser();
  const customization = parseCustomization(user.org.customizationJson);
  if (!customization.modules[module]) redirect("/");
  return { user, customization };
}
