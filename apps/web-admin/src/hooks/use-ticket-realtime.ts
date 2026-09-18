"use client";

import { useCallback } from "react";
import type { Database } from "@repo/supabase";
import { useRealtimeChannel, type RealtimeChannel, type RealtimeStatus } from "./use-realtime-channel";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];

export interface TicketRealtimeHandlers {
  onTicket: (ticket: Row<"discord_tickets">) => void;
  onMessage: (message: Row<"discord_ticket_messages">) => void;
  onEvent: (event: Row<"discord_ticket_events">) => void;
  /** The channel came back after a drop: anything sent meanwhile was missed. */
  onResync: () => void;
}

export type TicketRealtimeStatus = RealtimeStatus;

/**
 * Follows one ticket's rows: the ticket itself, its archived messages (edits
 * and soft deletes are updates) and its timeline events.
 */
export function useTicketRealtime(ticketId: string | null, handlers: TicketRealtimeHandlers): TicketRealtimeStatus {
  const build = useCallback(
    (channel: RealtimeChannel) =>
      channel
        .on<Row<"discord_tickets">>(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "discord_tickets", filter: `id=eq.${ticketId}` },
          (payload) => handlers.onTicket(payload.new),
        )
        .on<Row<"discord_ticket_messages">>(
          "postgres_changes",
          { event: "*", schema: "public", table: "discord_ticket_messages", filter: `ticket_id=eq.${ticketId}` },
          (payload) => {
            if (payload.eventType !== "DELETE") handlers.onMessage(payload.new);
          },
        )
        .on<Row<"discord_ticket_events">>(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "discord_ticket_events", filter: `ticket_id=eq.${ticketId}` },
          (payload) => handlers.onEvent(payload.new),
        ),
    [ticketId, handlers],
  );
  return useRealtimeChannel(ticketId ? `ticket:${ticketId}` : null, build, handlers.onResync);
}
