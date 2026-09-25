export * from "./components/overlay/types";
export type {
  OverlayEventType,
  OverlaySocketMessage,
  BotBroadcastMessage,
  StreamWizardEventType,
} from "@repo/types";
export * from "./components/overlay/widget-definition";
export {
  MIN_ITEM_SCALE,
  MAX_ITEM_SCALE,
  MIN_SOURCE_SIZE,
  NO_CROP,
  getDesignSize,
  getCropInsets,
  getSourceSize,
  hasCrop,
  getItemScale,
  applyScale,
  clampScale,
  clampCrop,
  type Size,
  type CropInsets,
} from "./components/overlay/lib/item-scale";
export {
  ANCHOR_X_VALUES,
  ANCHOR_Y_VALUES,
  DEFAULT_ANCHOR_X,
  DEFAULT_ANCHOR_Y,
  getAnchor,
  isAnchored,
  isAnchorX,
  isAnchorY,
  resolveAnchoredPosition,
  toAnchoredOffset,
  withAbsolutePosition,
  type Anchor,
  type AnchorX,
  type AnchorY,
} from "./components/overlay/lib/item-anchor";
export { itemFlipTransform, itemTransform } from "./components/overlay/lib/item-flip";
export { WidgetScaleFrame } from "./components/overlay/WidgetScaleFrame";
export { formatCountdownMs } from "./components/overlay/lib/format-countdown";
export { formatClockWidgetDisplay } from "./components/overlay/lib/format-clock-widget";
export {
  formatClipDuration,
  formatClipDate,
  formatClipViewCount,
  formatClipField,
  type ClipFieldData,
} from "./components/overlay/lib/format-clip-fields";
export {
  useGoogleFont,
  useGoogleFonts,
} from "./components/overlay/hooks/use-google-font";
export { TextWidgetRenderer } from "./components/overlay/widgets/text/TextWidgetRenderer";
export { TimerWidgetRenderer } from "./components/overlay/widgets/timer/TimerWidgetRenderer";
export { ClockWidgetRenderer } from "./components/overlay/widgets/clock/ClockWidgetRenderer";
export { ClipsWidgetRenderer } from "./components/overlay/widgets/clips/ClipsWidgetRenderer";
export type {
  ClipsWidgetRendererProps,
  NextClipResult,
  ClipRotationCursor,
} from "./components/overlay/widgets/clips/ClipsWidgetRenderer";
export type { WidgetRenderProps } from "./components/overlay/widgets/text/TextWidgetRenderer";
export {
  textWidgetBaseDefinition,
  TEXT_WIDGET_DEFAULT_SIZE,
} from "./components/overlay/widgets/text/text-widget-definition";
export {
  timerWidgetBaseDefinition,
  TIMER_WIDGET_DEFAULT_SIZE,
} from "./components/overlay/widgets/timer/timer-widget-definition";
export {
  clockWidgetBaseDefinition,
  CLOCK_WIDGET_DEFAULT_SIZE,
} from "./components/overlay/widgets/clock/clock-widget-definition";
export {
  clipsWidgetBaseDefinition,
  CLIPS_WIDGET_DEFAULT_SIZE,
} from "./components/overlay/widgets/clips/clips-widget-definition";
export {
  IrlFieldWidgetRenderer,
  IRL_FIELD_WIDGET_DEFAULT_SIZE,
  collectIrlFieldFontFamilies,
  DEFAULT_IRL_FIELD_WIDGET_ITEM_CONFIG,
} from "./components/overlay/widgets/irl/irl-field-widget-definition";
export type { IrlFieldWidgetRendererProps } from "./components/overlay/widgets/irl/IrlFieldWidgetRenderer";
export {
  useIrlGeoData,
  type IrlConnectionStatus,
} from "./components/overlay/widgets/irl/use-irl-geo-data";
export {
  subscribeToWsRoom,
  subscribeToWsRoomWith,
  wsStatusFromMessage,
  type WsEventListener,
  type WsRoomOptions,
  type WsRoomStatus,
} from "./components/overlay/lib/ws-store";
export {
  ALERT_EVENT_TYPES,
  ALERT_EVENT_CATEGORIES,
  ALERT_EVENT_SUBSCRIPTION_TYPES,
  ALERT_EVENT_LABELS,
  ALERT_AMOUNT_LABELS,
  ALERT_NAME_LABELS,
  ALERT_DEFAULT_ON_EVENTS,
  ALERT_MESSAGE_EVENTS,
  ALERT_GIFTER_EVENTS,
  ALERT_DETAIL_TOKENS,
  ALERT_LAYOUTS,
  ALERT_DURATION_MODES,
  ALERT_ANIMATIONS_IN,
  ALERT_ANIMATIONS_OUT,
  ALERT_TEST_BROWSER_EVENT,
  DEFAULT_ALERT_VARIANT_TITLES,
  createDefaultAlertWidgetConfig,
  createDefaultAlertVariantConfig,
  normalizeAlertWidgetConfig,
  alertInstanceFromSocketMessage,
  alertSkipReason,
  renderAlertTemplate,
  alertAmountText,
  buildTestAlertSocketMessage,
  type AlertEventType,
  type AlertEventCategoryId,
  type AlertMediaKind,
  type AlertLayout,
  type AlertAnimationIn,
  type AlertAnimationOut,
  type AlertDurationMode,
  type AlertVariantConfig,
  type AlertWidgetItemConfig,
  type AlertInstance,
  type AlertSkipReason,
  type AlertTestBrowserEventDetail,
} from "./components/overlay/widgets/alert/alert-widget-config";
export { AlertWidgetRenderer } from "./components/overlay/widgets/alert/AlertWidgetRenderer";
export type { AlertWidgetRendererProps } from "./components/overlay/widgets/alert/AlertWidgetRenderer";
export {
  alertWidgetBaseDefinition,
  ALERT_WIDGET_DEFAULT_SIZE,
} from "./components/overlay/widgets/alert/alert-widget-definition";
export {
  CHAT_WIDGET_PRESETS,
  CHAT_WIDGET_PRESET_LABELS,
  CHAT_WIDGET_DIRECTIONS,
  CHAT_WIDGET_LAYOUTS,
  CHAT_WIDGET_ANIMATIONS_IN,
  CHAT_WIDGET_ANIMATIONS_OUT,
  CHAT_WIDGET_ANIMATION_LABELS,
  CHAT_WIDGET_NAME_COLOR_MODES,
  CHAT_WIDGET_NOTICE_KINDS,
  CHAT_WIDGET_NOTICE_LABELS,
  CHAT_WIDGET_EMOTE_PROVIDERS,
  CHAT_WIDGET_EMOTE_PROVIDER_LABELS,
  CHAT_WIDGET_LIMITS,
  DEFAULT_CHAT_WIDGET_HIDDEN_USERS,
  chatNoticeKind,
  chatWidgetHorizontalHeight,
  CHAT_WIDGET_VERTICAL_SIZE,
  CHAT_WIDGET_HORIZONTAL_MIN_WIDTH,
  createDefaultChatWidgetConfig,
  normalizeChatWidgetConfig,
  normalizeChatWidgetHiddenUsers,
  type ChatWidgetPreset,
  type ChatWidgetDirection,
  type ChatWidgetLayout,
  type ChatWidgetAnimationIn,
  type ChatWidgetAnimationOut,
  type ChatWidgetNameColorMode,
  type ChatWidgetNoticeKind,
  type ChatWidgetItemConfig,
} from "./components/overlay/widgets/chat/chat-widget-config";
export { ChatWidgetRenderer } from "./components/overlay/widgets/chat/ChatWidgetRenderer";
export type { ChatWidgetRendererProps } from "./components/overlay/widgets/chat/ChatWidgetRenderer";
export {
  chatWidgetBaseDefinition,
  CHAT_WIDGET_DEFAULT_SIZE,
} from "./components/overlay/widgets/chat/chat-widget-definition";
export {
  GOAL_WIDGET_TYPES,
  GOAL_WIDGET_PRESETS,
  GOAL_WIDGET_PRESET_LABELS,
  GOAL_WIDGET_PRESET_SIZES,
  GOAL_WIDGET_ARCADE_FONT,
  GOAL_WIDGET_FILL_MODES,
  GOAL_WIDGET_CELEBRATIONS,
  GOAL_WIDGET_CELEBRATION_LABELS,
  GOAL_WIDGET_ANIMATIONS_IN,
  GOAL_WIDGET_ANIMATIONS_OUT,
  GOAL_WIDGET_ANIMATION_LABELS,
  GOAL_WIDGET_ON_END,
  GOAL_WIDGET_LABELS,
  GOAL_WIDGET_LIMITS,
  TWITCH_GOAL_TYPES,
  TWITCH_GOAL_TYPE_LABELS,
  isGoalWidgetType,
  twitchGoalTypesFor,
  createDefaultGoalWidgetConfig,
  goalPresetChange,
  normalizeGoalWidgetConfig,
  type GoalWidgetType,
  type GoalWidgetOnEnd,
  type GoalWidgetPreset,
  type GoalWidgetFillMode,
  type GoalWidgetCelebration,
  type GoalWidgetAnimationIn,
  type GoalWidgetAnimationOut,
  type GoalWidgetItemConfig,
  type TwitchGoalType,
} from "./components/overlay/widgets/goal/goal-widget-config";
export {
  GOAL_RESET_BROWSER_EVENT,
  applyGoalFrame,
  goalProgress,
  isDemoGoalFrame,
  pickGoal,
  seedGoals,
  type FetchedGoal,
  type GoalResetBrowserEventDetail,
  type GoalSnapshot,
  type GoalWidgetFrame,
  type GoalWidgetState,
} from "./components/overlay/widgets/goal/goal-widget-state";
export { GoalWidgetRenderer } from "./components/overlay/widgets/goal/GoalWidgetRenderer";
export type { GoalWidgetRendererProps } from "./components/overlay/widgets/goal/GoalWidgetRenderer";
export {
  followerGoalWidgetBaseDefinition,
  subGoalWidgetBaseDefinition,
  bitsGoalWidgetBaseDefinition,
  GOAL_WIDGET_DEFAULT_SIZE,
} from "./components/overlay/widgets/goal/goal-widget-definition";
export {
  POLL_WIDGET_TYPE,
  POLL_MAX_CHOICES,
  POLL_WIDGET_PRESETS,
  POLL_WIDGET_PRESET_LABELS,
  POLL_WIDGET_PRESET_SIZES,
  POLL_WIDGET_COLOR_MODES,
  POLL_WIDGET_CELEBRATIONS,
  POLL_WIDGET_ANIMATIONS_IN,
  POLL_WIDGET_ANIMATIONS_OUT,
  POLL_WIDGET_LIMITS,
  POLL_DEFAULT_CHOICE_COLORS,
  createDefaultPollWidgetConfig,
  normalizePollWidgetConfig,
  type PollWidgetType,
  type PollWidgetPreset,
  type PollWidgetColorMode,
  type PollWidgetCelebration,
  type PollWidgetAnimationIn,
  type PollWidgetAnimationOut,
  type PollWidgetItemConfig,
} from "./components/overlay/widgets/poll/poll-widget-config";
export {
  DEMO_POLL_ID,
  POLL_RESET_BROWSER_EVENT,
  applyPollFrame,
  isDemoPollFrame,
  seedPoll,
  type FetchedPoll,
  type PollResetBrowserEventDetail,
  type PollSnapshot,
  type PollWidgetFrame,
  type PollWidgetState,
} from "./components/overlay/widgets/poll/poll-widget-state";
export { buildPollView, type PollView, type PollChoiceView } from "./components/overlay/widgets/poll/poll-view";
export { PollWidgetRenderer } from "./components/overlay/widgets/poll/PollWidgetRenderer";
export type { PollWidgetRendererProps } from "./components/overlay/widgets/poll/PollWidgetRenderer";
export { pollWidgetBaseDefinition, POLL_WIDGET_DEFAULT_SIZE } from "./components/overlay/widgets/poll/poll-widget-definition";
export {
  AD_WIDGET_TYPE,
  AD_WIDGET_PRESETS,
  AD_WIDGET_PRESET_LABELS,
  AD_WIDGET_PRESET_SIZES,
  AD_WIDGET_ANIMATIONS_IN,
  AD_WIDGET_ANIMATIONS_OUT,
  AD_WIDGET_LIMITS,
  AD_TIME_TOKEN,
  createDefaultAdWidgetConfig,
  normalizeAdWidgetConfig,
  type AdWidgetType,
  type AdWidgetPreset,
  type AdWidgetAnimationIn,
  type AdWidgetAnimationOut,
  type AdWidgetItemConfig,
} from "./components/overlay/widgets/ads/ad-widget-config";
export {
  AD_BACK_MS,
  AD_RESET_BROWSER_EVENT,
  AD_SCHEDULE_TEST_BROWSER_EVENT,
  EMPTY_AD_STATE,
  adPhase,
  applyAdFrame,
  formatAdTime,
  isDemoAdFrame,
  scheduleFrom,
  type AdPhase,
  type AdPhaseView,
  type AdResetBrowserEventDetail,
  type AdScheduleSnapshot,
  type AdScheduleTestBrowserEventDetail,
  type AdWidgetFrame,
  type AdWidgetState,
  type FetchedAdSchedule,
} from "./components/overlay/widgets/ads/ad-widget-state";
export { AdWidgetRenderer } from "./components/overlay/widgets/ads/AdWidgetRenderer";
export type { AdWidgetRendererProps } from "./components/overlay/widgets/ads/AdWidgetRenderer";
export { adWidgetBaseDefinition, AD_WIDGET_DEFAULT_SIZE } from "./components/overlay/widgets/ads/ad-widget-definition";
export {
  UPTIME_WIDGET_TYPE,
  UPTIME_WIDGET_LAYOUTS,
  UPTIME_WIDGET_LIMITS,
  createDefaultUptimeWidgetConfig,
  normalizeUptimeWidgetConfig,
  formatUptime,
  type UptimeWidgetType,
  type UptimeWidgetLayout,
  type UptimeWidgetItemConfig,
} from "./components/overlay/widgets/uptime/uptime-widget-config";
export { UptimeWidgetRenderer } from "./components/overlay/widgets/uptime/UptimeWidgetRenderer";
export type { UptimeWidgetRendererProps } from "./components/overlay/widgets/uptime/UptimeWidgetRenderer";
export { uptimeWidgetBaseDefinition, UPTIME_WIDGET_DEFAULT_SIZE } from "./components/overlay/widgets/uptime/uptime-widget-definition";
export {
  CREDITS_WIDGET_TYPE,
  CREDITS_WIDGET_PRESETS,
  CREDITS_WIDGET_PRESET_LABELS,
  CREDITS_WIDGET_PRESET_SIZES,
  CREDITS_WIDGET_ARCADE_FONT,
  CREDITS_SCROLL_PRESETS,
  CREDITS_SECTION_IDS,
  CREDITS_SECTION_DEFAULT_LABELS,
  CREDITS_SECTION_NAMES,
  CREDITS_DEFAULT_SECTIONS,
  CREDITS_WIDGET_LIMITS,
  createDefaultCreditsWidgetConfig,
  normalizeCreditsWidgetConfig,
  normalizeCreditsSections,
  creditsPresetChange,
  creditsSectionHasLabel,
  isCreditsScrollPreset,
  isCreditsSectionId,
  type CreditsWidgetType,
  type CreditsWidgetPreset,
  type CreditsSectionId,
  type CreditsSection,
  type CreditsWidgetItemConfig,
} from "./components/overlay/widgets/credits/credits-widget-config";
export {
  CREDITS_ROLL_BROWSER_EVENT,
  CREDITS_RESET_BROWSER_EVENT,
  streamChangedFromFrame,
  type CreditsRollBrowserEventDetail,
  type CreditsResetBrowserEventDetail,
  type CreditsWidgetFrame,
} from "./components/overlay/widgets/credits/credits-widget-state";
export {
  buildCreditsView,
  formatCreditsDuration,
  formatCreditsNumber,
  type CreditsViewSection,
  type CreditsViewName,
} from "./components/overlay/widgets/credits/credits-view";
export { CreditsWidgetRenderer } from "./components/overlay/widgets/credits/CreditsWidgetRenderer";
export type { CreditsWidgetRendererProps } from "./components/overlay/widgets/credits/CreditsWidgetRenderer";
export { creditsWidgetBaseDefinition, CREDITS_WIDGET_DEFAULT_SIZE } from "./components/overlay/widgets/credits/credits-widget-definition";
export {
  resolveWidgetTemplate,
  buildWidgetSrcdoc,
  mergeFieldValues,
  ASSET_FIELD_TYPES,
  isAssetFieldType,
  GROUP_FIELD_TYPE,
  isGroupFieldDef,
  flattenFieldSchema,
  type WidgetFieldDef,
  type WidgetFieldSchema,
} from "./components/overlay/lib/resolve-widget-template";
export {
  WIDGET_SIMULATORS,
  WIDGET_SIMULATOR_IDS,
  type SimulatorDef,
  type SimulatorEmit,
} from "./components/overlay/lib/widget-simulators";
export {
  scanWidgetListeners,
  type WidgetListenerScan,
} from "./components/overlay/lib/detect-widget-listeners";
export {
  OverlaySceneCanvas,
  type OverlayWidgetProps,
  type OverlayWidgetRegistration,
} from "./components/overlay/OverlaySceneCanvas";
export {
  CustomWidgetIframe,
  type CustomWidgetIframeHandle,
  type CustomWidgetIframeProps,
  type WidgetLogEntry,
} from "./components/overlay/CustomWidgetIframe";
