"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { DEAL_STAGES, fmtMoney } from "@/lib/crm-constants";

type DealCard = {
  id: string;
  name: string;
  stage: string;
  amount: number;
  accountName?: string | null;
  ownerName?: string | null;
  coachScore?: number | null;
  callCount: number;
};

type StageOpt = { key: string; label: string };
const GENERIC_COLUMNS: StageOpt[] = DEAL_STAGES.map((s) => ({ key: s.key, label: s.label }));

export function PipelineBoard({
  initialDeals,
  stages = GENERIC_COLUMNS,
}: {
  initialDeals: DealCard[];
  /** The org's industry-pack stages; defaults to the generic set. */
  stages?: StageOpt[];
}) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStage = useMemo(() => {
    const known = new Set(stages.map((s) => s.key));
    const columns = stages.map((stage) => ({
      ...stage,
      deals: deals.filter((d) => d.stage === stage.key),
    }));
    // Deals whose stage predates an industry-pack switch land in a visible
    // "Legacy" column so nothing silently disappears; drag them into a real
    // stage to migrate.
    const orphans = deals.filter((d) => !known.has(d.stage));
    if (orphans.length) columns.push({ key: "__legacy", label: "Legacy stages", deals: orphans });
    return columns;
  }, [deals, stages]);

  const activeDeal = deals.find((d) => d.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const dealId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;

    const stageKeys = stages.map((s) => s.key);
    let nextStage: string | undefined = stageKeys.includes(overId)
      ? overId
      : deals.find((d) => d.id === overId)?.stage;
    if (!nextStage || nextStage === "__legacy") return;

    const current = deals.find((d) => d.id === dealId);
    if (!current || current.stage === nextStage) return;

    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: nextStage! } : d)));
    const res = await fetch(`/api/crm/deals/${dealId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: nextStage }),
    });
    if (!res.ok) {
      setDeals(initialDeals);
      return;
    }
    startTransition(() => router.refresh());
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className={`flex gap-3 overflow-x-auto pb-4 ${pending ? "opacity-80" : ""}`}>
        {byStage.map((col) => (
          <StageColumn key={col.key} stageKey={col.key} label={col.label} deals={col.deals} />
        ))}
      </div>
      <DragOverlay>
        {activeDeal ? <DealTile deal={activeDeal} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function StageColumn({
  stageKey,
  label,
  deals,
}: {
  stageKey: string;
  label: string;
  deals: DealCard[];
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stageKey });
  const total = deals.reduce((s, d) => s + d.amount, 0);
  return (
    <div className="w-64 shrink-0">
      <div className="flex items-center justify-between mb-2 px-1">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">{label}</h2>
        <span className="text-xs text-muted tabular-nums">
          {deals.length}
          {deals.length > 0 && <span className="ml-1 opacity-70">· {fmtMoney(total)}</span>}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`space-y-2 min-h-[120px] rounded-xl border p-2 transition-colors ${
          isOver ? "border-accent/50 bg-accent/5" : "border-line/60 bg-surface-2/40"
        }`}
      >
        {deals.length === 0 && <p className="text-[11px] text-muted px-2 py-6 text-center">Drop deals here</p>}
        {deals.map((deal) => (
          <DraggableDeal key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
}

function DraggableDeal({ deal }: { deal: DealCard }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-40" : ""} {...listeners} {...attributes}>
      <DealTile deal={deal} />
    </div>
  );
}

function DealTile({ deal, overlay }: { deal: DealCard; overlay?: boolean }) {
  return (
    <Link
      href={`/crm/deals/${deal.id}`}
      onClick={(e) => {
        if (overlay) e.preventDefault();
      }}
      className={`block rounded-lg border border-line bg-surface p-3 hover:border-accent/40 transition-colors ${
        overlay ? "shadow-xl cursor-grabbing" : "cursor-grab"
      }`}
    >
      <div className="text-sm font-medium leading-snug">{deal.name}</div>
      <div className="text-xs text-muted mt-1">
        {deal.accountName ?? "No account"}
        {deal.ownerName ? ` · ${deal.ownerName}` : ""}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm tabular-nums font-medium">{fmtMoney(deal.amount)}</span>
        {deal.coachScore != null ? (
          <span className="text-[11px] rounded-md border border-accent/30 bg-accent/10 text-accent-hover px-1.5 py-0.5 tabular-nums">
            Coach {deal.coachScore}
          </span>
        ) : deal.callCount > 0 ? (
          <span className="text-[11px] text-muted">{deal.callCount} calls</span>
        ) : null}
      </div>
    </Link>
  );
}
