import { supabase } from "@repo/supabase";
import {
  autoSwitcherConfigSchema,
  resolveAutoSwitcherThresholds,
  type AutoSwitcherConfig,
  type AutoSwitcherThresholds,
} from "@repo/schemas";

export interface EffectiveConfig {
  row: AutoSwitcherConfig;
  thresholds: AutoSwitcherThresholds;
}

export type ConfigChangeHandler = (userId: string, config: EffectiveConfig | null) => void;

// In-memory view of obs_auto_switcher_configs (enabled rows only). The DB is
// the source of truth: boot + 60s reconciliation load it wholesale; between
// reconciliations, streamwizard.auto_switcher_config pushes off the consumer
// feed (sent by the web server actions through /internal/broadcast) apply the
// same row within ~1s. There is deliberately NO Supabase realtime here.
const RECONCILE_INTERVAL_MS = 60_000;

export class ConfigStore {
  private configs = new Map<string, EffectiveConfig>();
  private onChange: ConfigChangeHandler;
  private reconcileTimer: ReturnType<typeof setInterval> | null = null;

  constructor(onChange: ConfigChangeHandler) {
    this.onChange = onChange;
  }

  get(userId: string): EffectiveConfig | undefined {
    return this.configs.get(userId);
  }

  get size(): number {
    return this.configs.size;
  }

  userIds(): string[] {
    return [...this.configs.keys()];
  }

  async start(): Promise<void> {
    await this.reconcile();
    this.reconcileTimer = setInterval(() => {
      this.reconcile().catch((err) => console.error("[config-store] reconcile failed:", (err as Error).message));
    }, RECONCILE_INTERVAL_MS);
  }

  stop(): void {
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
  }

  /** A config row pushed over the consumer feed. */
  applyPush(payload: unknown): void {
    const parsed = autoSwitcherConfigSchema.safeParse(payload);
    if (!parsed.success) {
      console.warn("[config-store] dropping malformed config push:", parsed.error.message);
      return;
    }
    this.applyRow(parsed.data);
  }

  private applyRow(row: AutoSwitcherConfig): void {
    if (!row.enabled) {
      if (this.configs.delete(row.user_id)) {
        console.log(`[config-store] disabled user=${row.user_id}`);
        this.onChange(row.user_id, null);
      } else {
        // Still forward: an override write on a disabled row is a no-op, but
        // the monitor may exist from a not-yet-reconciled enable.
        this.onChange(row.user_id, null);
      }
      return;
    }
    const effective: EffectiveConfig = { row, thresholds: resolveAutoSwitcherThresholds(row) };
    this.configs.set(row.user_id, effective);
    this.onChange(row.user_id, effective);
  }

  private async reconcile(): Promise<void> {
    const { data, error } = await supabase.from("obs_auto_switcher_configs").select("*").eq("enabled", true);
    if (error) throw error;

    const seen = new Set<string>();
    for (const raw of data ?? []) {
      const parsed = autoSwitcherConfigSchema.safeParse(raw);
      if (!parsed.success) {
        console.warn(`[config-store] skipping malformed config row user=${(raw as { user_id?: string }).user_id}:`, parsed.error.message);
        continue;
      }
      seen.add(parsed.data.user_id);
      const prev = this.configs.get(parsed.data.user_id);
      // Cheap change detection is fine at reconcile cadence; pushes handle
      // the latency-sensitive path.
      if (!prev || JSON.stringify(prev.row) !== JSON.stringify(parsed.data)) {
        this.applyRow(parsed.data);
      }
    }
    for (const userId of this.configs.keys()) {
      if (!seen.has(userId)) {
        this.configs.delete(userId);
        this.onChange(userId, null);
      }
    }
  }
}
