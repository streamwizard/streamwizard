"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { cn } from "@/lib/utils";
import {
  saveNotificationConfig,
  sendTestNotification,
  type TestSendResult,
} from "@/actions/alert-notifications";

type EnvName = "prod" | "staging" | "dev";
type SeverityGate = "off" | "warn" | "crit";
type DiscordTarget = "channel" | "dm";

const GATE_LABELS: Record<SeverityGate, string> = {
  off: "Off",
  warn: "Warn + crit",
  crit: "Crit only",
};

export interface EnvNotifyView {
  env: EnvName;
  hasRow: boolean;
  discordChannelId: string | null;
  discordTarget: DiscordTarget;
  discordSeverity: SeverityGate;
  telegramChatId: string | null;
  telegramSeverity: SeverityGate;
}

export interface TokenStatus {
  discordToken: boolean;
  telegramToken: boolean;
  discordChannelFallback: boolean;
  telegramChatFallback: boolean;
}

// The trigger's own height rides on a data-[size] variant, so a plain h-* loses to it.
const TRIGGER_SIZE = "w-full text-base data-[size=default]:h-11 md:text-sm md:data-[size=default]:h-8";

function SeveritySelect({
  value,
  onChange,
  disabled,
  label,
}: {
  value: SeverityGate;
  onChange: (v: SeverityGate) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SeverityGate)} disabled={disabled}>
      <SelectTrigger className={cn(TRIGGER_SIZE, "lg:w-32")} aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(GATE_LABELS) as SeverityGate[]).map((gate) => (
          <SelectItem key={gate} value={gate}>
            {GATE_LABELS[gate]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EnvCard({ view, tokens, isHome }: { view: EnvNotifyView; tokens: TokenStatus; isHome: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [discordId, setDiscordId] = useState(view.discordChannelId ?? "");
  const [discordTarget, setDiscordTarget] = useState<DiscordTarget>(view.discordTarget);
  const [discordSeverity, setDiscordSeverity] = useState<SeverityGate>(view.discordSeverity);
  const [telegramId, setTelegramId] = useState(view.telegramChatId ?? "");
  const [telegramSeverity, setTelegramSeverity] = useState<SeverityGate>(view.telegramSeverity);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestSendResult | null>(null);

  const dirty =
    (discordId.trim() || null) !== view.discordChannelId ||
    discordTarget !== view.discordTarget ||
    discordSeverity !== view.discordSeverity ||
    (telegramId.trim() || null) !== view.telegramChatId ||
    telegramSeverity !== view.telegramSeverity;

  const save = () =>
    startTransition(async () => {
      setError(null);
      try {
        await saveNotificationConfig({
          env: view.env,
          discordChannelId: discordId.trim() || null,
          discordTarget,
          discordSeverity,
          telegramChatId: telegramId.trim() || null,
          telegramSeverity,
        });
        router.refresh();
        toast.success(`Saved ${view.env} notifications`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save");
      }
    });

  // One tap sends a real message, so the answer has to be impossible to miss:
  // a toast, plus the line under the form that stays after the toast is gone.
  const test = (channel: "discord" | "telegram") =>
    startTransition(async () => {
      setTestResult(null);
      const name = channel === "discord" ? "Discord" : "Telegram";
      try {
        const result = await sendTestNotification(view.env, channel);
        setTestResult(result);
        if (result.ok) toast.success(`${name} test sent for ${view.env}`, { description: result.detail });
        else toast.error(`${name} test failed for ${view.env}`, { description: result.detail });
      } catch (err) {
        const detail = err instanceof Error ? err.message : "Couldn't send the test";
        setTestResult({ ok: false, detail });
        toast.error(`${name} test failed for ${view.env}`, { description: detail });
      }
    });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="uppercase">{view.env}</span>
          {isHome && <Badge variant="outline">this deployment</Badge>}
          {view.hasRow && (
            <Badge variant="outline" className="font-normal">
              customized
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* One column until there is room for the five tracks: name, target, ID, severity, Test. */}
        <div className="grid grid-cols-1 items-center gap-2 lg:grid-cols-[6rem_auto_1fr_auto_auto]">
          <span className="text-sm font-medium lg:font-normal">Discord</span>
          <Select value={discordTarget} onValueChange={(v) => setDiscordTarget(v as DiscordTarget)} disabled={isPending}>
            <SelectTrigger className={cn(TRIGGER_SIZE, "lg:w-28")} aria-label="Discord target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="channel">Channel</SelectItem>
              <SelectItem value="dm">DM</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder={
              discordTarget === "dm"
                ? "user ID"
                : tokens.discordChannelFallback
                  ? "using env default channel"
                  : "channel ID"
            }
            aria-label={discordTarget === "dm" ? "Discord user ID" : "Discord channel ID"}
            inputMode="numeric"
            disabled={isPending}
            className="h-11 font-mono md:h-8"
          />
          <div className="flex gap-2 lg:contents">
            <div className="min-w-0 flex-1 lg:flex-none">
              <SeveritySelect value={discordSeverity} onChange={setDiscordSeverity} disabled={isPending} label="Discord severity" />
            </div>
            <Button size="sm" variant="outline" className="h-11 px-4 md:h-8" onClick={() => test("discord")} disabled={isPending}>
              Test
            </Button>
          </div>

          <span className="text-sm font-medium max-lg:mt-3 max-lg:border-t max-lg:pt-4 lg:font-normal">Telegram</span>
          <span className="hidden text-xs text-muted-foreground lg:block">chat</span>
          <Input
            value={telegramId}
            onChange={(e) => setTelegramId(e.target.value)}
            placeholder={tokens.telegramChatFallback ? "using env default chat" : "chat ID"}
            aria-label="Telegram chat ID"
            disabled={isPending}
            className="h-11 font-mono md:h-8"
          />
          <div className="flex gap-2 lg:contents">
            <div className="min-w-0 flex-1 lg:flex-none">
              <SeveritySelect value={telegramSeverity} onChange={setTelegramSeverity} disabled={isPending} label="Telegram severity" />
            </div>
            <Button size="sm" variant="outline" className="h-11 px-4 md:h-8" onClick={() => test("telegram")} disabled={isPending}>
              Test
            </Button>
          </div>
        </div>

        {dirty && <p className="text-xs text-muted-foreground">Test sends through the saved settings. Save first to test these changes.</p>}

        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="min-w-0 text-sm" aria-live="polite">
            {error && (
              <span className="text-destructive" role="alert">
                {error}
              </span>
            )}
            {testResult && (
              <StatusIndicator status={testResult.ok ? "ok" : "crit"} label={testResult.detail} className="items-start break-words [&>span]:mt-1.5" />
            )}
          </div>
          {dirty && (
            <Button size="sm" className="h-11 w-full sm:w-auto md:h-8" onClick={save} disabled={isPending}>
              Save
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function NotificationsEditor({
  envs,
  tokens,
  homeEnv,
}: {
  envs: EnvNotifyView[];
  tokens: TokenStatus;
  homeEnv: EnvName;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <StatusIndicator
          status={tokens.discordToken ? "ok" : "muted"}
          label={tokens.discordToken ? "Discord bot token configured" : "DISCORD_BOT_TOKEN missing (set in Doppler)"}
        />
        <StatusIndicator
          status={tokens.telegramToken ? "ok" : "muted"}
          label={tokens.telegramToken ? "Telegram bot token configured" : "TELEGRAM_BOT_TOKEN missing (set in Doppler)"}
        />
      </div>
      {envs.map((view) => (
        <EnvCard key={view.env} view={view} tokens={tokens} isHome={view.env === homeEnv} />
      ))}
    </div>
  );
}
