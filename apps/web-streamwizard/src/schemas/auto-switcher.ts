import { z } from "zod";
import { autoSwitcherConfigSchema } from "@repo/schemas";

export {
  AUTO_SWITCHER_PRESET_THRESHOLDS,
  AUTO_SWITCHER_SENSITIVITY_PRESETS,
  autoSwitcherThresholdsSchema,
  autoSwitcherStatusSchema,
} from "@repo/schemas";

// Everything the settings form edits — the override fields live on the same
// row but are driven by the override controls, not the form.
export const autoSwitcherFormSchema = autoSwitcherConfigSchema
  .omit({
    user_id: true,
    override_scene_uuid: true,
    override_scene_name: true,
    override_expires_at: true,
  })
  .superRefine((val, ctx) => {
    if (!val.enabled) return;
    if (!val.scene_live_uuid) {
      ctx.addIssue({ code: "custom", path: ["scene_live_uuid"], message: "Pick the scene you stream from." });
    }
    if (!val.scene_offline_uuid) {
      ctx.addIssue({ code: "custom", path: ["scene_offline_uuid"], message: "Pick a scene to show when the signal is gone." });
    }
    if (val.scene_model === "three" && !val.scene_degraded_uuid) {
      ctx.addIssue({ code: "custom", path: ["scene_degraded_uuid"], message: "Pick a scene for when the connection gets rough." });
    }
    if (val.warning_source_enabled && !val.warning_source_uuid && !val.warning_source_name) {
      ctx.addIssue({ code: "custom", path: ["warning_source_uuid"], message: "Pick the source to show as a warning." });
    }
    if (val.mode === "advanced" && !val.advanced_thresholds) {
      ctx.addIssue({ code: "custom", path: ["advanced_thresholds"], message: "Advanced mode needs threshold values." });
    }
  });

export type AutoSwitcherFormValues = z.infer<typeof autoSwitcherFormSchema>;
