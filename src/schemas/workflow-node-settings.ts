import { z } from "zod";

export const SendChatMessageSchema = z.object({
  sender_id: z.string(),
  message: z.string().max(500, { message: "Message must not exceed 500 characters." }),
});

// create type from schema
export type SendChatMessageMetaData = z.infer<typeof SendChatMessageSchema>;