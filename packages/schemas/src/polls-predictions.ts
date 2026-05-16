import { z } from "zod";

// ─── Shared poll choice schemas ──────────────────────────────────────────────

const PollVotingSchema = z.object({
  is_enabled: z.boolean(),
  amount_per_vote: z.number().int(),
});

const PollChoiceBaseSchema = z.object({
  id: z.string(),
  title: z.string(),
});

const PollChoiceWithVotesSchema = PollChoiceBaseSchema.extend({
  bits_votes: z.number().int(),
  channel_points_votes: z.number().int(),
  votes: z.number().int(),
});

// ─── channel.poll.begin ─────────────────────────────────────────────────────

export const ChannelPollBeginEventSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  title: z.string(),
  choices: z.array(PollChoiceBaseSchema),
  bits_voting: PollVotingSchema,
  channel_points_voting: PollVotingSchema,
  started_at: z.string(),
  ends_at: z.string(),
});

export type ChannelPollBeginEvent = z.infer<typeof ChannelPollBeginEventSchema>;

// ─── channel.poll.progress ──────────────────────────────────────────────────

export const ChannelPollProgressEventSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  title: z.string(),
  choices: z.array(PollChoiceWithVotesSchema),
  bits_voting: PollVotingSchema,
  channel_points_voting: PollVotingSchema,
  started_at: z.string(),
  ends_at: z.string(),
});

export type ChannelPollProgressEvent = z.infer<typeof ChannelPollProgressEventSchema>;

// ─── channel.poll.end ───────────────────────────────────────────────────────

export const ChannelPollEndEventSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  title: z.string(),
  choices: z.array(PollChoiceWithVotesSchema),
  bits_voting: PollVotingSchema,
  channel_points_voting: PollVotingSchema,
  status: z.enum(["completed", "archived", "terminated"]),
  started_at: z.string(),
  ended_at: z.string(),
});

export type ChannelPollEndEvent = z.infer<typeof ChannelPollEndEventSchema>;

// ─── Shared prediction schemas ───────────────────────────────────────────────

const TopPredictorSchema = z.object({
  user_id: z.string(),
  user_name: z.string(),
  user_login: z.string(),
  channel_points_won: z.number().int().nullable(),
  channel_points_used: z.number().int(),
});

const PredictionOutcomeBaseSchema = z.object({
  id: z.string(),
  title: z.string(),
  color: z.enum(["blue", "pink"]),
});

const PredictionOutcomeWithStatsSchema = PredictionOutcomeBaseSchema.extend({
  users: z.number().int(),
  channel_points: z.number().int(),
  top_predictors: z.array(TopPredictorSchema),
});

// ─── channel.prediction.begin ───────────────────────────────────────────────

export const ChannelPredictionBeginEventSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  title: z.string(),
  outcomes: z.array(PredictionOutcomeBaseSchema),
  started_at: z.string(),
  locks_at: z.string(),
});

export type ChannelPredictionBeginEvent = z.infer<typeof ChannelPredictionBeginEventSchema>;

// ─── channel.prediction.progress ────────────────────────────────────────────

export const ChannelPredictionProgressEventSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  title: z.string(),
  outcomes: z.array(PredictionOutcomeWithStatsSchema),
  started_at: z.string(),
  locks_at: z.string(),
});

export type ChannelPredictionProgressEvent = z.infer<typeof ChannelPredictionProgressEventSchema>;

// ─── channel.prediction.lock ────────────────────────────────────────────────

export const ChannelPredictionLockEventSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  title: z.string(),
  outcomes: z.array(PredictionOutcomeWithStatsSchema),
  started_at: z.string(),
  locked_at: z.string(),
});

export type ChannelPredictionLockEvent = z.infer<typeof ChannelPredictionLockEventSchema>;

// ─── channel.prediction.end ─────────────────────────────────────────────────

export const ChannelPredictionEndEventSchema = z.object({
  id: z.string(),
  broadcaster_user_id: z.string(),
  broadcaster_user_login: z.string(),
  broadcaster_user_name: z.string(),
  title: z.string(),
  winning_outcome_id: z.string(),
  outcomes: z.array(PredictionOutcomeWithStatsSchema),
  status: z.enum(["resolved", "canceled"]),
  started_at: z.string(),
  ended_at: z.string(),
});

export type ChannelPredictionEndEvent = z.infer<typeof ChannelPredictionEndEventSchema>;