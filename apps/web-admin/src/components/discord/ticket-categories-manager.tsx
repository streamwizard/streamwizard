"use client";

import {
  createTicketCategoryAction,
  removeTicketCategoryAction,
  reorderTicketCategoriesAction,
  restoreTicketCategoryAction,
  updateTicketCategoryAction,
} from "@/actions/discord-ticket-config";
import type { PickerOption } from "@/lib/discord/options";
import { TicketOptionsManager, type TicketOption, type TicketOptionDraft } from "./ticket-options-manager";

interface TicketCategoriesManagerProps {
  items: TicketOption[];
  discordCategories: PickerOption[];
  limit: number;
  nameMax: number;
  descriptionMax: number;
}

const toInput = (draft: TicketOptionDraft) => ({
  name: draft.name,
  description: draft.description,
  emoji: draft.emoji,
  enabled: draft.enabled,
  discordCategoryId: draft.discordCategoryId,
});

export function TicketCategoriesManager(props: TicketCategoriesManagerProps) {
  return (
    <TicketOptionsManager
      kind="category"
      title="Categories"
      description="What a ticket is filed under. Members pick one before they fill in the form. Drag to change the order they see."
      {...props}
      onCreate={(draft) => createTicketCategoryAction(toInput(draft))}
      onUpdate={(id, draft) => updateTicketCategoryAction(id, toInput(draft))}
      onRemove={removeTicketCategoryAction}
      onRestore={restoreTicketCategoryAction}
      onReorder={reorderTicketCategoriesAction}
    />
  );
}
