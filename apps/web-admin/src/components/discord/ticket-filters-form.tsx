"use client";

import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

/**
 * A GET form for the ticket filters. Selects and date inputs apply themselves
 * on change; typing in a text field waits for Enter or the Apply button, so a
 * half-typed search doesn't reload the page under you. Submits navigate with
 * only the fields that hold a value, so URLs stay shareable. Without
 * JavaScript it degrades to a plain form submit.
 */
export function TicketFiltersForm({ children, className }: { children: React.ReactNode; className?: string }) {
  const router = useRouter();

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const query = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value.trim()) query.set(key, value.trim());
    }
    const search = query.toString();
    router.push(search ? `${form.getAttribute("action") ?? ""}?${search}` : form.getAttribute("action") ?? "");
  };

  const onChange = (event: FormEvent<HTMLFormElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement) && !(target instanceof HTMLInputElement && target.type === "date")) return;
    event.currentTarget.requestSubmit();
  };

  return (
    <form method="get" action="/discord/tickets" onSubmit={onSubmit} onChange={onChange} className={className}>
      {children}
    </form>
  );
}
