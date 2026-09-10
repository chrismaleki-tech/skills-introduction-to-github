import { db } from "./db";
import { fmtMoney } from "./crm";

/** ERP deepening: tax/FX, multi-warehouse inventory, GL, HR/projects, AP. */

export const CURRENCIES = ["USD", "EUR", "GBP", "CAD"] as const;

export function fxMultiplier(rateToBase: number) {
  return rateToBase / 10000;
}

export function toBase(amount: number, rateToBase: number) {
  return Math.round(amount * fxMultiplier(rateToBase));
}

export async function getOrgErpDefaults(orgId: string) {
  const org = await db.org.findUniqueOrThrow({ where: { id: orgId } });
  return {
    baseCurrency: org.baseCurrency || "USD",
    defaultTaxCode: org.defaultTaxCode || "US-CA",
  };
}

export async function resolveTaxRate(orgId: string, taxCode?: string | null) {
  const code = taxCode || (await getOrgErpDefaults(orgId)).defaultTaxCode;
  const row = await db.taxCode.findFirst({ where: { orgId, code, active: true } });
  return { code, ratePercent: row?.ratePercent ?? 0, name: row?.name ?? code };
}

export async function resolveFxRate(orgId: string, currency: string) {
  const { baseCurrency } = await getOrgErpDefaults(orgId);
  if (!currency || currency === baseCurrency) return 10000;
  const row = await db.fxRate.findFirst({
    where: { orgId, currency },
    orderBy: { asOf: "desc" },
  });
  return row?.rateToBase ?? 10000;
}

export async function ensureDefaultWarehouse(orgId: string) {
  const existing = await db.warehouse.findFirst({
    where: { orgId, isDefault: true },
    include: { bins: true },
  });
  if (existing) return existing;
  return db.warehouse.create({
    data: {
      orgId,
      code: "MAIN",
      name: "Main warehouse",
      isDefault: true,
      bins: { create: [{ code: "A-01", name: "Receiving" }, { code: "B-01", name: "Pick face" }] },
    },
    include: { bins: true },
  });
}

async function syncProductQty(productId: string) {
  const balances = await db.inventoryBalance.findMany({ where: { productId } });
  const qtyOnHand = balances.reduce((s, b) => s + b.qtyOnHand, 0);
  const qtyReserved = balances.reduce((s, b) => s + b.qtyReserved, 0);
  await db.product.update({
    where: { id: productId },
    data: { qtyOnHand, qtyReserved, trackInventory: true },
  });
}

export async function adjustWarehouseStock(input: {
  orgId: string;
  productId: string;
  warehouseId: string;
  binId?: string | null;
  deltaOnHand?: number;
  deltaReserved?: number;
}) {
  const existing = await db.inventoryBalance.findUnique({
    where: {
      warehouseId_productId: {
        warehouseId: input.warehouseId,
        productId: input.productId,
      },
    },
  });
  if (existing) {
    await db.inventoryBalance.update({
      where: { id: existing.id },
      data: {
        qtyOnHand: Math.max(0, existing.qtyOnHand + (input.deltaOnHand ?? 0)),
        qtyReserved: Math.max(0, existing.qtyReserved + (input.deltaReserved ?? 0)),
        ...(input.binId ? { binId: input.binId } : {}),
      },
    });
  } else {
    await db.inventoryBalance.create({
      data: {
        orgId: input.orgId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        binId: input.binId ?? null,
        qtyOnHand: Math.max(0, input.deltaOnHand ?? 0),
        qtyReserved: Math.max(0, input.deltaReserved ?? 0),
      },
    });
  }
  await syncProductQty(input.productId);
}

async function nextDocNumber(orgId: string, prefix: string, kind: "je" | "tr" | "gr" | "vb" | "pr") {
  const count =
    kind === "je"
      ? await db.journalEntry.count({ where: { orgId } })
      : kind === "tr"
        ? await db.stockTransfer.count({ where: { orgId } })
        : kind === "gr"
          ? await db.goodsReceipt.count({ where: { orgId } })
          : kind === "vb"
            ? await db.vendorBill.count({ where: { orgId } })
            : await db.project.count({ where: { orgId } });
  return `${prefix}-${String(1001 + count)}`;
}

export async function ensureChartOfAccounts(orgId: string) {
  const count = await db.glAccount.count({ where: { orgId } });
  if (count > 0) return;
  const accounts = [
    { code: "1000", name: "Cash", type: "asset" },
    { code: "1100", name: "Accounts Receivable", type: "asset" },
    { code: "1200", name: "Inventory", type: "asset" },
    { code: "2000", name: "Accounts Payable", type: "liability" },
    { code: "2100", name: "Sales Tax Payable", type: "liability" },
    { code: "3000", name: "Owner Equity", type: "equity" },
    { code: "4000", name: "Product Revenue", type: "revenue" },
    { code: "4100", name: "Services Revenue", type: "revenue" },
    { code: "5000", name: "Cost of Goods Sold", type: "cogs" },
    { code: "6000", name: "Operating Expense", type: "expense" },
    { code: "6100", name: "Payroll Expense", type: "expense" },
    { code: "6200", name: "Implementation Labor", type: "expense" },
  ];
  for (const a of accounts) {
    await db.glAccount.create({ data: { orgId, ...a } });
  }
}

async function glByCode(orgId: string, code: string) {
  await ensureChartOfAccounts(orgId);
  const acct = await db.glAccount.findFirst({ where: { orgId, code } });
  if (!acct) throw new Error(`GL account ${code} missing.`);
  return acct;
}

export async function postJournal(input: {
  orgId: string;
  userId?: string | null;
  memo: string;
  sourceType: string;
  sourceId?: string | null;
  currency?: string;
  lines: Array<{ accountCode: string; debit?: number; credit?: number; memo?: string }>;
}) {
  // Idempotent when sourceType+sourceId provided
  if (input.sourceId) {
    const existing = await db.journalEntry.findFirst({
      where: { orgId: input.orgId, sourceType: input.sourceType, sourceId: input.sourceId },
    });
    if (existing) return existing;
  }

  const prepared = [];
  for (const line of input.lines) {
    const debit = Math.max(0, Math.round(line.debit ?? 0));
    const credit = Math.max(0, Math.round(line.credit ?? 0));
    if (debit === 0 && credit === 0) continue;
    const account = await glByCode(input.orgId, line.accountCode);
    prepared.push({
      accountId: account.id,
      debit,
      credit,
      memo: line.memo ?? "",
    });
  }
  const debits = prepared.reduce((s, l) => s + l.debit, 0);
  const credits = prepared.reduce((s, l) => s + l.credit, 0);
  if (debits !== credits) {
    throw new Error(`Unbalanced journal: debit ${debits} != credit ${credits}`);
  }
  if (prepared.length === 0) throw new Error("Journal has no lines.");

  const number = await nextDocNumber(input.orgId, "JE", "je");
  return db.journalEntry.create({
    data: {
      orgId: input.orgId,
      number,
      memo: input.memo,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      currency: input.currency ?? (await getOrgErpDefaults(input.orgId)).baseCurrency,
      postedById: input.userId ?? null,
      lines: { create: prepared },
    },
    include: { lines: { include: { account: true } } },
  });
}

export async function postInvoiceToGl(invoiceId: string, userId?: string) {
  const invoice = await db.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const rate = invoice.fxRateToBase || 10000;
  const total = toBase(invoice.total, rate);
  const tax = toBase(invoice.taxAmount, rate);
  const revenue = total - tax;
  return postJournal({
    orgId: invoice.orgId,
    userId,
    memo: `AR for ${invoice.number}`,
    sourceType: "invoice",
    sourceId: invoice.id,
    currency: invoice.currency,
    lines: [
      { accountCode: "1100", debit: total, memo: invoice.number },
      { accountCode: "4000", credit: revenue, memo: "Revenue" },
      ...(tax > 0 ? [{ accountCode: "2100", credit: tax, memo: "Tax" }] : []),
    ],
  });
}

export async function postPaymentToGl(paymentId: string, userId?: string) {
  const payment = await db.payment.findUniqueOrThrow({
    where: { id: paymentId },
    include: { invoice: true },
  });
  const rate = payment.invoice.fxRateToBase || 10000;
  const amount = toBase(payment.amount, rate);
  return postJournal({
    orgId: payment.orgId,
    userId,
    memo: `Payment on ${payment.invoice.number}`,
    sourceType: "payment",
    sourceId: payment.id,
    currency: payment.currency,
    lines: [
      { accountCode: "1000", debit: amount, memo: payment.reference || payment.method },
      { accountCode: "1100", credit: amount, memo: payment.invoice.number },
    ],
  });
}

export async function postVendorBillToGl(billId: string, userId?: string) {
  const bill = await db.vendorBill.findUniqueOrThrow({ where: { id: billId } });
  return postJournal({
    orgId: bill.orgId,
    userId,
    memo: `AP bill ${bill.number}`,
    sourceType: "bill",
    sourceId: bill.id,
    currency: bill.currency,
    lines: [
      { accountCode: "1200", debit: bill.subtotal, memo: "Inventory / expense receipt" },
      ...(bill.taxAmount > 0 ? [{ accountCode: "6000", debit: bill.taxAmount, memo: "Tax" }] : []),
      { accountCode: "2000", credit: bill.total, memo: bill.number },
    ],
  });
}

export async function exportGlCsv(orgId: string) {
  const entries = await db.journalEntry.findMany({
    where: { orgId },
    include: { lines: { include: { account: true } } },
    orderBy: { postedAt: "asc" },
  });
  const rows = [["entry", "date", "memo", "account", "account_name", "debit", "credit", "source"]];
  for (const e of entries) {
    for (const l of e.lines) {
      rows.push([
        e.number,
        e.postedAt.toISOString().slice(0, 10),
        e.memo,
        l.account.code,
        l.account.name,
        String(l.debit),
        String(l.credit),
        `${e.sourceType}:${e.sourceId ?? ""}`,
      ]);
    }
  }
  return rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
}

export async function glTrialBalance(orgId: string) {
  await ensureChartOfAccounts(orgId);
  const accounts = await db.glAccount.findMany({
    where: { orgId, active: true },
    include: { lines: true },
    orderBy: { code: "asc" },
  });
  return accounts.map((a) => {
    const debit = a.lines.reduce((s, l) => s + l.debit, 0);
    const credit = a.lines.reduce((s, l) => s + l.credit, 0);
    return {
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      debit,
      credit,
      balance: debit - credit,
    };
  });
}

export async function createStockTransfer(input: {
  orgId: string;
  userId: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  notes?: string;
  lines: Array<{ productId: string; quantity: number }>;
}) {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new Error("From and to warehouses must differ.");
  }
  const number = await nextDocNumber(input.orgId, "TR", "tr");
  return db.stockTransfer.create({
    data: {
      orgId: input.orgId,
      number,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      createdById: input.userId,
      notes: input.notes ?? "",
      status: "draft",
      lines: {
        create: input.lines.map((l) => ({
          productId: l.productId,
          quantity: Math.max(1, Math.round(l.quantity)),
        })),
      },
    },
    include: { lines: true },
  });
}

export async function postStockTransfer(transferId: string, orgId: string) {
  const transfer = await db.stockTransfer.findFirst({
    where: { id: transferId, orgId },
    include: { lines: true },
  });
  if (!transfer) throw new Error("Transfer not found.");
  if (transfer.status === "posted") return transfer;

  for (const line of transfer.lines) {
    await adjustWarehouseStock({
      orgId,
      productId: line.productId,
      warehouseId: transfer.fromWarehouseId,
      deltaOnHand: -line.quantity,
    });
    await adjustWarehouseStock({
      orgId,
      productId: line.productId,
      warehouseId: transfer.toWarehouseId,
      deltaOnHand: line.quantity,
    });
  }

  return db.stockTransfer.update({
    where: { id: transferId },
    data: { status: "posted", postedAt: new Date() },
  });
}

export async function approvePurchaseOrder(poId: string, orgId: string, userId: string) {
  const po = await db.purchaseOrder.findFirst({ where: { id: poId, orgId } });
  if (!po) throw new Error("PO not found.");
  if (!["draft", "pending_approval", "submitted"].includes(po.status)) {
    throw new Error(`Cannot approve a ${po.status} PO.`);
  }
  return db.purchaseOrder.update({
    where: { id: poId },
    data: {
      status: "approved",
      approvedById: userId,
      approvedAt: new Date(),
    },
  });
}

/** Partial or full receive into a warehouse + optional vendor bill (3-way match start). */
export async function receivePurchaseOrderDeep(input: {
  orgId: string;
  userId: string;
  poId: string;
  warehouseId?: string;
  lines?: Array<{ productId?: string | null; quantity: number; description?: string }>;
  createVendorBill?: boolean;
}) {
  const po = await db.purchaseOrder.findFirst({
    where: { id: input.poId, orgId: input.orgId },
    include: { lines: true, vendor: true },
  });
  if (!po) throw new Error("PO not found.");
  if (po.status === "cancelled") throw new Error("Cannot receive a cancelled PO.");

  const warehouse =
    (input.warehouseId
      ? await db.warehouse.findFirst({ where: { id: input.warehouseId, orgId: input.orgId } })
      : null) ||
    (po.warehouseId
      ? await db.warehouse.findFirst({ where: { id: po.warehouseId } })
      : null) ||
    (await ensureDefaultWarehouse(input.orgId));

  const receiveLines =
    input.lines?.length
      ? input.lines
      : po.lines.map((l) => ({
          productId: l.productId,
          quantity: Math.max(0, l.quantity - l.qtyReceived),
          description: l.description,
        }));

  const effective = receiveLines.filter((l) => l.quantity > 0);
  if (effective.length === 0) throw new Error("Nothing left to receive.");

  const grNumber = await nextDocNumber(input.orgId, "GR", "gr");
  const receipt = await db.goodsReceipt.create({
    data: {
      orgId: input.orgId,
      number: grNumber,
      purchaseOrderId: po.id,
      warehouseId: warehouse.id,
      status: "posted",
      lines: {
        create: effective.map((l) => ({
          productId: l.productId || null,
          description: l.description || "",
          quantity: Math.round(l.quantity),
        })),
      },
    },
    include: { lines: true },
  });

  for (const line of effective) {
    if (line.productId) {
      await adjustWarehouseStock({
        orgId: input.orgId,
        productId: line.productId,
        warehouseId: warehouse.id,
        deltaOnHand: Math.round(line.quantity),
      });
    }
    if (line.productId) {
      const poLine = po.lines.find((l) => l.productId === line.productId);
      if (poLine) {
        await db.purchaseOrderLine.update({
          where: { id: poLine.id },
          data: { qtyReceived: poLine.qtyReceived + Math.round(line.quantity) },
        });
      }
    }
  }

  const refreshed = await db.purchaseOrder.findUniqueOrThrow({
    where: { id: po.id },
    include: { lines: true },
  });
  const allReceived = refreshed.lines.every((l) => l.qtyReceived >= l.quantity);
  const anyReceived = refreshed.lines.some((l) => l.qtyReceived > 0);
  await db.purchaseOrder.update({
    where: { id: po.id },
    data: {
      status: allReceived ? "received" : anyReceived ? "partial" : refreshed.status,
      receivedAt: allReceived ? new Date() : refreshed.receivedAt,
      warehouseId: warehouse.id,
    },
  });

  let bill = null;
  if (input.createVendorBill !== false) {
    const subtotal = effective.reduce((s, l) => {
      const poLine = po.lines.find((p) => p.productId === l.productId || p.description === l.description);
      return s + Math.round(l.quantity) * (poLine?.unitCost ?? 0);
    }, 0);
    const vbNumber = await nextDocNumber(input.orgId, "VB", "vb");
    const due = new Date();
    due.setDate(due.getDate() + (po.vendor.paymentTermsDays || 30));
    bill = await db.vendorBill.create({
      data: {
        orgId: input.orgId,
        number: vbNumber,
        vendorId: po.vendorId,
        purchaseOrderId: po.id,
        status: "open",
        currency: po.currency,
        subtotal,
        taxAmount: 0,
        total: subtotal,
        dueAt: due,
        notes: `Matched to ${po.number} / ${receipt.number}`,
        lines: {
          create: effective.map((l) => {
            const poLine = po.lines.find((p) => p.productId === l.productId || p.description === l.description);
            const qty = Math.round(l.quantity);
            const unitCost = poLine?.unitCost ?? 0;
            return {
              productId: l.productId || null,
              description: l.description || poLine?.description || "PO line",
              quantity: qty,
              unitCost,
              lineTotal: qty * unitCost,
            };
          }),
        },
      },
    });
    await postVendorBillToGl(bill.id, input.userId);
  }

  return { receipt, bill };
}

export async function createProject(input: {
  orgId: string;
  ownerId: string;
  code?: string;
  name: string;
  dealId?: string | null;
  accountId?: string | null;
  budgetHours?: number;
  budgetAmount?: number;
  currency?: string;
  managerEmployeeId?: string | null;
  tasks?: Array<{ title: string; estimateHrs?: number; productId?: string | null }>;
}) {
  const code = input.code?.trim() || (await nextDocNumber(input.orgId, "PRJ", "pr"));
  return db.project.create({
    data: {
      orgId: input.orgId,
      code,
      name: input.name.trim(),
      status: "active",
      dealId: input.dealId ?? null,
      accountId: input.accountId ?? null,
      ownerId: input.ownerId,
      managerEmployeeId: input.managerEmployeeId ?? null,
      budgetHours: input.budgetHours ?? 0,
      budgetAmount: input.budgetAmount ?? 0,
      currency: input.currency ?? "USD",
      startDate: new Date(),
      tasks: input.tasks?.length
        ? {
            create: input.tasks.map((t, i) => ({
              title: t.title,
              estimateHrs: t.estimateHrs ?? 0,
              productId: t.productId ?? null,
              sortOrder: i,
            })),
          }
        : undefined,
    },
    include: { tasks: true },
  });
}

export async function logTimeEntry(input: {
  orgId: string;
  projectId: string;
  userId?: string;
  employeeId?: string | null;
  taskId?: string | null;
  hours: number;
  workDate?: Date;
  notes?: string;
  billable?: boolean;
}) {
  return db.timeEntry.create({
    data: {
      orgId: input.orgId,
      projectId: input.projectId,
      userId: input.userId ?? null,
      employeeId: input.employeeId ?? null,
      taskId: input.taskId ?? null,
      hours: Math.max(1, Math.round(input.hours)),
      workDate: input.workDate ?? new Date(),
      notes: input.notes ?? "",
      billable: input.billable !== false,
      status: "approved",
    },
  });
}

export async function payrollAccrualSnapshot(orgId: string) {
  const employees = await db.employee.findMany({
    where: { orgId, status: "active" },
  });
  const monthly = employees.reduce((s, e) => s + Math.round(e.salaryAnnual / 12), 0);
  return {
    headcount: employees.length,
    annualPayroll: employees.reduce((s, e) => s + e.salaryAnnual, 0),
    monthlyAccrual: monthly,
    byDepartment: Object.entries(
      employees.reduce<Record<string, { count: number; annual: number }>>((acc, e) => {
        const key = e.department || "General";
        acc[key] = acc[key] || { count: 0, annual: 0 };
        acc[key].count += 1;
        acc[key].annual += e.salaryAnnual;
        return acc;
      }, {}),
    ).map(([department, v]) => ({ department, ...v })),
  };
}

export async function postMonthlyPayrollJournal(orgId: string, userId: string) {
  const snap = await payrollAccrualSnapshot(orgId);
  if (snap.monthlyAccrual <= 0) throw new Error("No active salaried employees.");
  const period = new Date().toISOString().slice(0, 7);
  return postJournal({
    orgId,
    userId,
    memo: `Payroll accrual ${period}`,
    sourceType: "payroll",
    sourceId: `payroll:${period}`,
    lines: [
      { accountCode: "6100", debit: snap.monthlyAccrual, memo: "Payroll expense" },
      { accountCode: "2000", credit: snap.monthlyAccrual, memo: "Payroll payable" },
    ],
  });
}

export function formatMoneyMulti(amount: number, currency: string, baseCurrency: string, rateToBase: number) {
  const primary = fmtMoney(amount, currency);
  if (currency === baseCurrency) return primary;
  return `${primary} (≈ ${fmtMoney(toBase(amount, rateToBase), baseCurrency)})`;
}
