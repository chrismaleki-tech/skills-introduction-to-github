"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteCallButton({ callId }: { callId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!window.confirm("Permanently delete this call, recording, transcript, and score?")) return;
    setPending(true);
    const response = await fetch(`/api/calls/${callId}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/calls");
      router.refresh();
      return;
    }
    setPending(false);
    window.alert("The call could not be deleted. Try again.");
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={pending}
      className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete call"}
    </button>
  );
}
