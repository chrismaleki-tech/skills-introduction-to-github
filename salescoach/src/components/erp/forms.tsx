"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui";

type ProductOpt = { id: string; name: string; sku: string; listPrice: number; unit: string };
type DealOpt = { id: string; name: string; accountId: string | null; contactId: string | null };
type AccountOpt = { id: string; name: string };

type DraftLine = {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export function NewProductForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/erp/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sku: fd.get("sku"),
        name: fd.get("name"),
        description: fd.get("description"),
        category: fd.get("category"),
        listPrice: Number(fd.get("listPrice") ?? 0),
        cost: Number(fd.get("cost") ?? 0),
        unit: fd.get("unit"),
        trackInventory: fd.get("trackInventory") === "on",
        qtyOnHand: Number(fd.get("qtyOnHand") ?? 0),
        reorderPoint: Number(fd.get("reorderPoint") ?? 0),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to create product.");
      return;
    }
    setOpen(false);
    startTransition(() => router.refresh());
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        New product
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="bg-surface border border-line rounded-xl p-4 space-y-3 w-full max-w-lg">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="SKU" name="sku" required placeholder="CORE-SEAT" />
        <Field label="Name" name="name" required placeholder="Meridian Core" />
        <Field label="List price" name="listPrice" type="number" defaultValue="0" />
        <Field label="Cost" name="cost" type="number" defaultValue="0" />
        <Field label="Unit" name="unit" defaultValue="seat" />
        <label className="text-sm">
          <span className="text-xs text-muted uppercase tracking-wider">Category</span>
          <select name="category" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
            <option>Software</option>
            <option>Service</option>
            <option>Hardware</option>
            <option>Other</option>
          </select>
        </label>
      </div>
      <label className="block text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Description</span>
        <textarea name="description" rows={2} className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="trackInventory" className="rounded border-line" />
        Track inventory
      </label>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Qty on hand" name="qtyOnHand" type="number" defaultValue="0" />
        <Field label="Reorder point" name="reorderPoint" type="number" defaultValue="0" />
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          Save
        </Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function AdjustStockForm({
  productId,
  qtyOnHand,
  reorderPoint,
}: {
  productId: string;
  qtyOnHand: number;
  reorderPoint: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(`/api/erp/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qtyOnHand: Number(fd.get("qtyOnHand") ?? qtyOnHand),
        reorderPoint: Number(fd.get("reorderPoint") ?? reorderPoint),
        trackInventory: true,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Update failed.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
      <Field label="On hand" name="qtyOnHand" type="number" defaultValue={String(qtyOnHand)} />
      <Field label="Reorder at" name="reorderPoint" type="number" defaultValue={String(reorderPoint)} />
      <Button type="submit" variant="secondary" disabled={pending}>
        Update
      </Button>
      {error && <p className="text-xs text-rose-400 w-full">{error}</p>}
    </form>
  );
}

export function NewQuoteForm({
  products,
  deals,
  accounts,
  defaultDealId,
}: {
  products: ProductOpt[];
  deals: DealOpt[];
  accounts: AccountOpt[];
  defaultDealId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(Boolean(defaultDealId));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dealId, setDealId] = useState(defaultDealId ?? "");
  const [lines, setLines] = useState<DraftLine[]>([
    { productId: products[0]?.id ?? "", description: products[0]?.name ?? "", quantity: 1, unitPrice: products[0]?.listPrice ?? 0 },
  ]);

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + Math.max(0, l.quantity) * Math.max(0, l.unitPrice), 0),
    [lines],
  );

  function setProduct(idx: number, productId: string) {
    const p = products.find((x) => x.id === productId);
    setLines((prev) =>
      prev.map((l, i) =>
        i === idx
          ? {
              ...l,
              productId,
              description: p?.name ?? l.description,
              unitPrice: p?.listPrice ?? l.unitPrice,
            }
          : l,
      ),
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const deal = deals.find((d) => d.id === dealId);
    const res = await fetch("/api/erp/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        notes: fd.get("notes"),
        taxRate: Number(fd.get("taxRate") ?? 0),
        dealId: dealId || null,
        accountId: deal?.accountId || fd.get("accountId") || null,
        contactId: deal?.contactId || null,
        lines: lines.map((l) => ({
          productId: l.productId || null,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to create quote.");
      return;
    }
    startTransition(() => {
      router.push(`/erp/quotes/${data.quote.id}`);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        New quote
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="bg-surface border border-line rounded-xl p-4 space-y-4 w-full">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Title" name="title" placeholder="Cascade Core rollout" />
        <label className="text-sm">
          <span className="text-xs text-muted uppercase tracking-wider">Deal</span>
          <select
            value={dealId}
            onChange={(e) => setDealId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
          >
            <option value="">No deal</option>
            {deals.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        {!dealId && (
          <label className="text-sm">
            <span className="text-xs text-muted uppercase tracking-wider">Account</span>
            <select name="accountId" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Field label="Tax %" name="taxRate" type="number" defaultValue="0" />
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted uppercase tracking-wider">Line items</div>
        {lines.map((line, idx) => (
          <div key={idx} className="grid sm:grid-cols-12 gap-2 items-end">
            <label className="sm:col-span-4 text-sm">
              <span className="text-[11px] text-muted">Product</span>
              <select
                value={line.productId}
                onChange={(e) => setProduct(idx, e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-2 py-2 text-sm"
              >
                <option value="">Custom</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} · {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="sm:col-span-4 text-sm">
              <span className="text-[11px] text-muted">Description</span>
              <input
                value={line.description}
                onChange={(e) =>
                  setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, description: e.target.value } : l)))
                }
                className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-2 py-2 text-sm"
              />
            </label>
            <label className="sm:col-span-2 text-sm">
              <span className="text-[11px] text-muted">Qty</span>
              <input
                type="number"
                min={1}
                value={line.quantity}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, i) => (i === idx ? { ...l, quantity: Number(e.target.value) || 1 } : l)),
                  )
                }
                className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-2 py-2 text-sm"
              />
            </label>
            <label className="sm:col-span-2 text-sm">
              <span className="text-[11px] text-muted">Price</span>
              <input
                type="number"
                min={0}
                value={line.unitPrice}
                onChange={(e) =>
                  setLines((prev) =>
                    prev.map((l, i) => (i === idx ? { ...l, unitPrice: Number(e.target.value) || 0 } : l)),
                  )
                }
                className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-2 py-2 text-sm"
              />
            </label>
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            setLines((prev) => [
              ...prev,
              {
                productId: products[0]?.id ?? "",
                description: products[0]?.name ?? "",
                quantity: 1,
                unitPrice: products[0]?.listPrice ?? 0,
              },
            ])
          }
        >
          Add line
        </Button>
      </div>

      <label className="block text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Notes</span>
        <textarea name="notes" rows={2} className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted">
          Subtotal <span className="text-foreground font-medium tabular-nums">${subtotal.toLocaleString()}</span>
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            Create quote
          </Button>
          {!defaultDealId && (
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          )}
        </div>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </form>
  );
}

export function QuoteActions({ quoteId, status }: { quoteId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function run(action: string) {
    setError(null);
    const res = await fetch(`/api/erp/quotes/${quoteId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Action failed.");
      return;
    }
    startTransition(() => {
      if (data.order?.id) router.push(`/erp/orders/${data.order.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {(status === "draft" || status === "sent") && (
        <Button disabled={pending} onClick={() => run("send")}>
          Send quote
        </Button>
      )}
      {(status === "draft" || status === "sent") && (
        <Button disabled={pending} onClick={() => run("accept")}>
          Accept → order
        </Button>
      )}
      {(status === "draft" || status === "sent") && (
        <Button disabled={pending} variant="danger" onClick={() => run("reject")}>
          Reject
        </Button>
      )}
      {error && <p className="text-xs text-rose-400 w-full">{error}</p>}
    </div>
  );
}

export function OrderActions({
  orderId,
  status,
  hasInvoice,
}: {
  orderId: string;
  status: string;
  hasInvoice: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function run(action: string) {
    setError(null);
    const res = await fetch(`/api/erp/orders/${orderId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Action failed.");
      return;
    }
    startTransition(() => {
      if (data.invoice?.id) router.push(`/erp/invoices/${data.invoice.id}`);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "pending" && (
        <Button disabled={pending} onClick={() => run("confirm")}>
          Confirm (close-won)
        </Button>
      )}
      {(status === "pending" || status === "confirmed") && (
        <Button disabled={pending} variant="secondary" onClick={() => run("fulfill")}>
          Fulfill
        </Button>
      )}
      {!hasInvoice && status !== "cancelled" && (
        <Button disabled={pending} onClick={() => run("invoice")}>
          Create invoice
        </Button>
      )}
      {error && <p className="text-xs text-rose-400 w-full">{error}</p>}
    </div>
  );
}

export function InvoiceActions({
  invoiceId,
  status,
  balance,
}: {
  invoiceId: string;
  status: string;
  balance: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(balance));

  async function send() {
    setError(null);
    const res = await fetch(`/api/erp/invoices/${invoiceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Send failed.");
      return;
    }
    startTransition(() => router.refresh());
  }

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/erp/invoices/${invoiceId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "pay", amount: Number(amount), method: "ach" }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Payment failed.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      {status === "draft" && (
        <Button disabled={pending} onClick={send}>
          Send invoice
        </Button>
      )}
      {balance > 0 && status !== "void" && status !== "draft" && (
        <form onSubmit={pay} className="flex flex-wrap items-end gap-2">
          <label className="text-sm block">
            <span className="text-xs text-muted uppercase tracking-wider">Payment amount</span>
            <input
              type="number"
              min={1}
              max={balance}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
            />
          </label>
          <Button type="submit" disabled={pending}>
            Record payment
          </Button>
        </form>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </div>
  );
}

export function NewVendorForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/erp/purchasing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "vendor",
        name: fd.get("name"),
        email: fd.get("email"),
        phone: fd.get("phone"),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed.");
      return;
    }
    (e.target as HTMLFormElement).reset();
    startTransition(() => router.refresh());
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-wrap gap-2 items-end">
      <Field label="Vendor" name="name" required placeholder="Acme Hardware" />
      <Field label="Email" name="email" type="email" />
      <Field label="Phone" name="phone" />
      <Button type="submit" disabled={pending}>
        Add vendor
      </Button>
      {error && <p className="text-xs text-rose-400 w-full">{error}</p>}
    </form>
  );
}

export function NewPoForm({
  vendors,
  products,
}: {
  vendors: { id: string; name: string }[];
  products: ProductOpt[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const tracked = products.filter((p) => true);
  const first = tracked[0];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const productId = String(fd.get("productId") || "");
    const product = products.find((p) => p.id === productId);
    const res = await fetch("/api/erp/purchasing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "po",
        vendorId: fd.get("vendorId"),
        notes: fd.get("notes"),
        lines: [
          {
            productId: productId || null,
            description: product?.name || "Stock replenishment",
            quantity: Number(fd.get("quantity") ?? 1),
            unitCost: Number(fd.get("unitCost") ?? 0),
          },
        ],
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed.");
      return;
    }
    startTransition(() => router.refresh());
  }

  if (vendors.length === 0) {
    return <p className="text-sm text-muted">Add a vendor first.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="grid sm:grid-cols-2 gap-3">
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Vendor</span>
        <select name="vendorId" required className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Product</span>
        <select name="productId" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} · {p.name}
            </option>
          ))}
        </select>
      </label>
      <Field label="Quantity" name="quantity" type="number" defaultValue="10" />
      <Field label="Unit cost" name="unitCost" type="number" defaultValue={String(first ? Math.round(first.listPrice * 0.4) : 0)} />
      <label className="sm:col-span-2 text-sm">
        <span className="text-xs text-muted uppercase tracking-wider">Notes</span>
        <input name="notes" className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm" />
      </label>
      <div className="sm:col-span-2">
        <Button type="submit" disabled={pending}>
          Create PO
        </Button>
        {error && <p className="text-xs text-rose-400 mt-2">{error}</p>}
      </div>
    </form>
  );
}

export function PoActions({ poId, status }: { poId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function run(action: string) {
    setError(null);
    const res = await fetch(`/api/erp/purchasing/${poId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed.");
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" && (
        <Button disabled={pending} variant="secondary" onClick={() => run("submit")}>
          Submit
        </Button>
      )}
      {(status === "draft" || status === "submitted") && (
        <Button disabled={pending} onClick={() => run("receive")}>
          Receive stock
        </Button>
      )}
      {error && <p className="text-xs text-rose-400 w-full">{error}</p>}
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
  value,
  onChange,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label className="text-sm block">
      <span className="text-xs text-muted uppercase tracking-wider">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        value={value}
        onChange={onChange}
        className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm"
      />
    </label>
  );
}
