/* Seed all customer demo tenants: npm run db:seed:customers
 * Discovers every spec in prisma/demo/tenants/*.ts and seeds the ones whose
 * org doesn't exist yet (idempotent — safe to run after db:seed or on an
 * existing database). */
process.env.SEEDING = "1";
process.env.INLINE_JOBS = "1";

import { readdirSync } from "fs";
import { join } from "path";
import { seedDemoTenant } from "./seed-demo-tenant";
import type { DemoTenantSpec } from "./types";

async function main() {
  const dir = join(__dirname, "tenants");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".ts"))
    .sort();
  if (!files.length) {
    console.error("No tenant specs found in prisma/demo/tenants/");
    process.exit(1);
  }
  for (const file of files) {
    const mod = (await import(join(dir, file))) as { spec?: DemoTenantSpec };
    if (!mod.spec) {
      throw new Error(`${file} does not export "spec"`);
    }
    await seedDemoTenant(mod.spec);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
