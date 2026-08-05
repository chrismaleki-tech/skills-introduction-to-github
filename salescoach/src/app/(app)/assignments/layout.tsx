import { requireModule } from "@/lib/module-guard";

/** Route guard: this section is off unless the org's "coaching" module is licensed. */
export default async function SectionLayout({ children }: { children: React.ReactNode }) {
  await requireModule("coaching");
  return children;
}
