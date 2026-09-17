"use client";

import {
  createTicketProductAction,
  removeTicketProductAction,
  reorderTicketProductsAction,
  restoreTicketProductAction,
  updateTicketProductAction,
} from "@/actions/discord-ticket-config";
import { TicketOptionsManager, type TicketOption, type TicketOptionDraft } from "./ticket-options-manager";

interface TicketProductsManagerProps {
  items: TicketOption[];
  limit: number;
  nameMax: number;
  descriptionMax: number;
}

const toInput = (draft: TicketOptionDraft) => ({
  label: draft.name,
  description: draft.description,
  emoji: draft.emoji,
});

export function TicketProductsManager(props: TicketProductsManagerProps) {
  return (
    <TicketOptionsManager
      kind="product"
      title="Products"
      description="What a ticket is about. Asked in the ticket form, and a filter on the ticket list. Drag to change the order."
      {...props}
      onCreate={(draft) => createTicketProductAction(toInput(draft))}
      onUpdate={(id, draft) => updateTicketProductAction(id, toInput(draft))}
      onRemove={removeTicketProductAction}
      onRestore={restoreTicketProductAction}
      onReorder={reorderTicketProductsAction}
    />
  );
}
