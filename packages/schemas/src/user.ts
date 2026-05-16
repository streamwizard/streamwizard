import { z } from "zod";

// ─── user.authorization.grant ────────────────────────────────────────────────

export const UserAuthorizationGrantEventSchema = z.object({
  client_id: z.string(),
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
});

export type UserAuthorizationGrantEvent = z.infer<typeof UserAuthorizationGrantEventSchema>;

// ─── user.authorization.revoke ───────────────────────────────────────────────

export const UserAuthorizationRevokeEventSchema = z.object({
  client_id: z.string(),
  user_id: z.string(),
  user_login: z.string().nullable(),
  user_name: z.string().nullable(),
});

export type UserAuthorizationRevokeEvent = z.infer<typeof UserAuthorizationRevokeEventSchema>;

// ─── user.update ─────────────────────────────────────────────────────────────

export const UserUpdateEventSchema = z.object({
  user_id: z.string(),
  user_login: z.string(),
  user_name: z.string(),
  email: z.string().optional(), // only present with user:read:email scope
  email_verified: z.boolean(),
  description: z.string(),
});

export type UserUpdateEvent = z.infer<typeof UserUpdateEventSchema>;

// ─── user.whisper.message ────────────────────────────────────────────────────

export const UserWhisperMessageEventSchema = z.object({
  from_user_id: z.string(),
  from_user_login: z.string(),
  from_user_name: z.string(),
  to_user_id: z.string(),
  to_user_login: z.string(),
  to_user_name: z.string(),
  whisper_id: z.string(),
  whisper: z.object({
    text: z.string(),
  }),
});

export type UserWhisperMessageEvent = z.infer<typeof UserWhisperMessageEventSchema>;