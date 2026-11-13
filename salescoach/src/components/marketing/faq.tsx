// Native <details> accordion: keyboard accessible, no JS, works without
// hydration. Each answer is written against verified product behaviour.

export interface FaqItem {
  q: string;
  a: React.ReactNode;
}

export function Faq({ items }: { items: FaqItem[] }) {
  return (
    <div className="divide-y divide-line rounded-2xl border border-line bg-white">
      {items.map((item) => (
        <details key={item.q} className="group px-5 py-1 sm:px-6">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left text-base font-semibold text-marketing-ink [&::-webkit-details-marker]:hidden">
            {item.q}
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-muted transition-transform group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <div className="pb-5 text-sm leading-relaxed text-muted">{item.a}</div>
        </details>
      ))}
    </div>
  );
}
