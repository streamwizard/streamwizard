import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { parseTicketOpening } from "@repo/discord-message";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import {
  getTicketCategory,
  isActiveProduct,
  listCategoryFormFields,
  listTicketProducts,
  TICKET_FIELD_LABEL_MAX,
  TICKET_FIELD_PLACEHOLDER_MAX,
  TICKET_FIELD_TEXT_MAX,
  TICKET_FORM_MAX_FIELDS,
  TICKET_LIMIT_MAX,
  TICKET_SELECT_MAX_OPTIONS,
  TICKET_SELECT_OPTION_MAX,
  TICKET_SUBJECT_MAX,
  ticketSelectOptions,
  type TicketFieldKind,
} from "@repo/supabase/queries/ticket-config";
import { Badge, Button } from "@repo/ui";
import { getTicketSettings } from "@repo/supabase/queries/tickets";
import { TicketCategoryRulesForm } from "@/components/discord/ticket-category-rules-form";
import { TicketFormEditor, type TicketFieldDraft } from "@/components/discord/ticket-form-editor";
import { TicketOpeningEditor } from "@/components/discord/ticket-opening-editor";
import { getBotProfile, getGuildRoles, requireDiscordContext } from "@/lib/discord/api";
import { toRoleOptions } from "@/lib/discord/options";
import { getBuilderThemes } from "@/lib/discord/theme-assets";
import { emojiForDisplay } from "@/lib/discord/ticket-options";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function DiscordTicketCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();

  const { guildId } = requireDiscordContext();
  const category = await getTicketCategory(supabaseAdmin, guildId, id);
  if (!category) notFound();

  const [fields, products, bot, roles, settings] = await Promise.all([
    listCategoryFormFields(supabaseAdmin, category.id),
    listTicketProducts(supabaseAdmin, guildId),
    getBotProfile(),
    getGuildRoles(),
    getTicketSettings(supabaseAdmin, guildId),
  ]);
  const rules = {
    staffRoleIds: category.staff_role_ids,
    pingRoleIds: category.ping_role_ids,
    requiredRoleIds: category.required_role_ids,
    memberLimit: category.member_limit,
    totalLimit: category.total_limit,
    cooldownSeconds: category.cooldown_seconds,
    slowmodeSeconds: category.slowmode_seconds,
    claimingEnabled: category.claiming_enabled,
    feedbackEnabled: category.feedback_enabled,
    channelNameTemplate: category.channel_name_template,
  };

  const drafts: TicketFieldDraft[] = fields.map((field) => ({
    id: field.id,
    kind: field.kind as TicketFieldKind,
    label: field.label,
    placeholder: field.placeholder,
    style: field.style === "paragraph" ? "paragraph" : "short",
    required: field.required,
    minLength: field.min_length,
    maxLength: field.max_length,
    options: ticketSelectOptions(field).map((option) => ({
      label: option.label,
      value: option.value,
      description: option.description ?? "",
      emoji: option.emoji ?? "",
    })),
  }));
  const emoji = emojiForDisplay(category.emoji);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Button variant="ghost" size="sm" className="-ml-2" asChild>
          <Link href="/discord/tickets/settings/categories">
            <ChevronLeft aria-hidden />
            All categories
          </Link>
        </Button>
        <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
          {emoji && <span aria-hidden="true">{emoji}</span>}
          {category.name}
          {category.archived_at ? (
            <Badge variant="outline">Archived</Badge>
          ) : (
            !category.enabled && <Badge variant="outline">Off</Badge>
          )}
        </h2>
        {category.description && <p className="text-sm text-muted-foreground">{category.description}</p>}
      </div>

      <TicketFormEditor
        // A save hands back database ids for new questions: start the editor over from them.
        key={JSON.stringify(drafts)}
        categoryId={category.id}
        initial={drafts}
        hasProducts={products.some(isActiveProduct)}
        limits={{
          maxFields: TICKET_FORM_MAX_FIELDS,
          labelMax: TICKET_FIELD_LABEL_MAX,
          placeholderMax: TICKET_FIELD_PLACEHOLDER_MAX,
          textMax: TICKET_FIELD_TEXT_MAX,
          subjectMax: TICKET_SUBJECT_MAX,
          maxOptions: TICKET_SELECT_MAX_OPTIONS,
          optionMax: TICKET_SELECT_OPTION_MAX,
        }}
      />

      <TicketCategoryRulesForm
        key={JSON.stringify(rules)}
        categoryId={category.id}
        initial={rules}
        roles={toRoleOptions(roles)}
        staffRoleName={roles.find((role) => role.id === settings?.staff_role_id)?.name ?? null}
        limitMax={TICKET_LIMIT_MAX}
      />

      <TicketOpeningEditor
        key={JSON.stringify(category.opening_message ?? null)}
        categoryId={category.id}
        initial={parseTicketOpening(category.opening_message)}
        themes={getBuilderThemes()}
        bot={bot}
      />
    </div>
  );
}
