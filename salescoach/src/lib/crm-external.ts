/**
 * External CRM connectors (Salesforce / HubSpot).
 * Built-in CRM is the source of truth today; these adapters are env-gated
 * stubs so production can wire OAuth + sync without schema changes.
 */

export type ExternalCrmProvider = "salesforce" | "hubspot";

export function externalCrmConfigured(provider: ExternalCrmProvider): boolean {
  if (provider === "salesforce") {
    return Boolean(
      process.env.SALESFORCE_CLIENT_ID &&
        process.env.SALESFORCE_CLIENT_SECRET &&
        process.env.SALESFORCE_INSTANCE_URL,
    );
  }
  return Boolean(process.env.HUBSPOT_ACCESS_TOKEN || process.env.HUBSPOT_CLIENT_ID);
}

export async function syncDealToExternalCrm(_input: {
  provider: ExternalCrmProvider;
  orgId: string;
  dealId: string;
}): Promise<{ ok: false; error: string } | { ok: true; externalId: string }> {
  if (!externalCrmConfigured(_input.provider)) {
    return {
      ok: false,
      error: `${_input.provider} is not configured. Set the provider OAuth/token env vars first.`,
    };
  }
  // Token exchange + object upsert land here when credentials are present.
  return {
    ok: false,
    error: `${_input.provider} sync adapter is configured but object mapping is not enabled for this deploy.`,
  };
}
