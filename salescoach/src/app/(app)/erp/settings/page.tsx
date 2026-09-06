import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { currentUser, isManagerRole } from "@/lib/session";
import { Card, EmptyState, PageHeader, fmtDate } from "@/components/ui";
import { TaxFxForms } from "@/components/erp/deep-forms";

export default async function ErpSettingsPage() {
  const user = await currentUser();
  if (!isManagerRole(user.role)) notFound();

  const [org, taxCodes, fxRates] = await Promise.all([
    db.org.findUniqueOrThrow({
      where: { id: user.orgId },
      select: { baseCurrency: true, defaultTaxCode: true },
    }),
    db.taxCode.findMany({ where: { orgId: user.orgId }, orderBy: { code: "asc" } }),
    db.fxRate.findMany({
      where: { orgId: user.orgId },
      orderBy: [{ currency: "asc" }, { asOf: "desc" }],
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="ERP settings"
        subtitle="Base currency, tax codes, and FX rates used on quotes, orders, and invoices."
      />

      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        <Card title="Defaults & codes">
          <TaxFxForms baseCurrency={org.baseCurrency} defaultTaxCode={org.defaultTaxCode} />
        </Card>
        <div className="space-y-6">
          <Card title="Tax codes">
            {taxCodes.length === 0 ? (
              <EmptyState title="No tax codes" />
            ) : (
              <ul className="divide-y divide-line text-sm">
                {taxCodes.map((t) => (
                  <li key={t.id} className="py-2 flex justify-between gap-3">
                    <span>
                      <span className="font-mono text-xs text-muted">{t.code}</span> {t.name}
                      {t.jurisdiction ? (
                        <span className="block text-xs text-muted">{t.jurisdiction}</span>
                      ) : null}
                    </span>
                    <span className="tabular-nums">{t.ratePercent}%</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card title="FX rates (to base)">
            {fxRates.length === 0 ? (
              <EmptyState title="No FX rates" hint="Base currency documents use rate 1.0." />
            ) : (
              <ul className="divide-y divide-line text-sm">
                {fxRates.map((r) => (
                  <li key={r.id} className="py-2 flex justify-between gap-3">
                    <span>
                      {r.currency}
                      <span className="block text-xs text-muted">{fmtDate(r.asOf)}</span>
                    </span>
                    <span className="tabular-nums">{(r.rateToBase / 10000).toFixed(4)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
