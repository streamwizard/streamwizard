"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/ui";
import { saveRuleConfig, resetRuleConfig } from "@/actions/alert-rules";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/widgets/responsive-dialog";
import { StatusIndicator } from "@/components/widgets/status-indicator";
import { useWideScreen } from "@/hooks/use-wide-screen";
import { cn } from "@/lib/utils";

type EnvName = "prod" | "staging" | "dev";
const ALL_ENVS: EnvName[] = ["prod", "staging", "dev"];

export interface RuleKnobView {
  default: number;
  unit: string;
  direction: "above" | "below";
}

export interface RuleConfigView {
  enabled: boolean;
  warn: number | null;
  crit: number | null;
  forTicks: number | null;
  envs: EnvName[] | null;
}

export interface RuleView {
  id: string;
  title: string;
  group: string;
  defaultForTicks: number;
  defaultEnvs: EnvName[];
  defaultEnabled: boolean;
  warn?: RuleKnobView;
  crit?: RuleKnobView;
  /** Existing override row, null when the rule runs on code defaults. */
  config: RuleConfigView | null;
}

const sameEnvs = (a: EnvName[], b: EnvName[]) => a.length === b.length && a.every((e) => b.includes(e));

/**
 * One rule's form: the fields, what counts as changed, and the two actions.
 * The table row and the phone drawer both run on it, so they save the same
 * payload through the same server action.
 */
function useRuleForm(rule: RuleView) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initial: RuleConfigView = rule.config ?? { enabled: rule.defaultEnabled, warn: null, crit: null, forTicks: null, envs: null };
  const [enabled, setEnabled] = useState(initial.enabled);
  const [warnText, setWarnText] = useState(initial.warn?.toString() ?? "");
  const [critText, setCritText] = useState(initial.crit?.toString() ?? "");
  const [ticksText, setTicksText] = useState(initial.forTicks?.toString() ?? "");
  const [envs, setEnvs] = useState<EnvName[] | null>(initial.envs);

  const parse = (text: string): number | null => (text.trim() === "" ? null : Number(text));

  const dirty =
    enabled !== initial.enabled ||
    parse(warnText) !== initial.warn ||
    parse(critText) !== initial.crit ||
    parse(ticksText) !== initial.forTicks ||
    (envs === null) !== (initial.envs === null) ||
    (envs !== null && initial.envs !== null && !sameEnvs(envs, initial.envs));

  const effectiveEnvs = envs ?? rule.defaultEnvs;

  const toggleEnv = (env: EnvName) => {
    const next = effectiveEnvs.includes(env) ? effectiveEnvs.filter((e) => e !== env) : [...effectiveEnvs, env];
    if (next.length === 0) return; // a rule must run somewhere; use the switch to disable it
    setEnvs(sameEnvs(next, rule.defaultEnvs) ? null : next);
  };

  const save = (onSaved?: () => void) =>
    startTransition(async () => {
      setError(null);
      try {
        await saveRuleConfig({
          ruleId: rule.id,
          enabled,
          warn: parse(warnText),
          crit: parse(critText),
          forTicks: parse(ticksText),
          envs,
        });
        router.refresh();
        toast.success(`Saved ${rule.title}`);
        onSaved?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save");
      }
    });

  const reset = (onReset?: () => void) =>
    startTransition(async () => {
      setError(null);
      try {
        await resetRuleConfig(rule.id);
        // Back to what the form shows for a rule without an override row.
        setEnabled(rule.defaultEnabled);
        setWarnText("");
        setCritText("");
        setTicksText("");
        setEnvs(null);
        router.refresh();
        toast.success(`${rule.title} is back on its defaults`);
        onReset?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't reset");
      }
    });

  return {
    isPending,
    error,
    dirty,
    enabled,
    setEnabled,
    warnText,
    setWarnText,
    critText,
    setCritText,
    ticksText,
    setTicksText,
    effectiveEnvs,
    toggleEnv,
    save,
    reset,
  };
}

type RuleForm = ReturnType<typeof useRuleForm>;

function ThresholdInput({
  id,
  knob,
  value,
  onChange,
  disabled,
  large = false,
}: {
  id?: string;
  knob?: RuleKnobView;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  /** The drawer version: full width and 44px tall. */
  large?: boolean;
}) {
  if (!knob) return <span className="text-muted-foreground">—</span>;
  return (
    <span className={cn("items-center gap-1.5 whitespace-nowrap", large ? "flex" : "inline-flex")}>
      <span className={cn("text-muted-foreground", large ? "text-sm" : "text-xs")}>{knob.direction === "above" ? ">" : "<"}</span>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={String(knob.default)}
        disabled={disabled}
        className={cn("text-right tabular-nums", large ? "h-11 min-w-0 flex-1" : "h-8 w-20")}
      />
      <span className={cn("text-muted-foreground", large ? "min-w-8 text-sm" : "text-xs")}>{knob.unit}</span>
    </span>
  );
}

function EnvToggles({ form, large = false }: { form: RuleForm; large?: boolean }) {
  return (
    <div className={cn("flex", large ? "gap-2" : "gap-1")} role="group" aria-label="Environments">
      {ALL_ENVS.map((env) => {
        const on = form.effectiveEnvs.includes(env);
        return (
          <button
            key={env}
            type="button"
            onClick={() => form.toggleEnv(env)}
            disabled={form.isPending}
            aria-pressed={on}
            className={cn(
              "rounded font-mono uppercase transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
              large ? "h-11 flex-1 rounded-md text-sm" : "px-1.5 py-1 text-xs",
              on ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground/60 line-through",
            )}
          >
            {env}
          </button>
        );
      })}
    </div>
  );
}

/** Reset drops the override row for good, so it asks first. */
function ResetRule({ rule, form, large = false, onReset }: { rule: RuleView; form: RuleForm; large?: boolean; onReset?: () => void }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant={large ? "outline" : "ghost"} className={cn("gap-1.5", !large && "h-7")} disabled={form.isPending}>
          <RotateCcw className="size-3.5" aria-hidden />
          {large ? "Reset to defaults" : "Reset"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset this rule to its defaults?</AlertDialogTitle>
          <AlertDialogDescription>
            {rule.title} loses its overrides: thresholds, for-ticks, environments and the enabled switch all go back to the code defaults. The
            engine picks it up on its next tick.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => form.reset(onReset)}>Reset rule</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RuleRow({ rule }: { rule: RuleView }) {
  const form = useRuleForm(rule);

  return (
    <TableRow className={form.enabled ? undefined : "opacity-50"}>
      {/* The name wraps so the inputs and the buttons stay on screen next to the sidebar. */}
      <TableCell className="min-w-40 whitespace-normal">
        <div className="font-medium">{rule.title}</div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <code className="font-mono text-xs text-muted-foreground">{rule.id}</code>
          {rule.config !== null && (
            <Badge variant="outline" className="h-5 px-1.5 text-xs font-normal">
              customized
            </Badge>
          )}
        </div>
        {form.error && <p className="mt-1 text-xs text-destructive">{form.error}</p>}
      </TableCell>
      <TableCell>
        <EnvToggles form={form} />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          value={form.ticksText}
          onChange={(e) => form.setTicksText(e.target.value)}
          placeholder={String(rule.defaultForTicks)}
          disabled={form.isPending}
          aria-label="For ticks"
          className="h-8 w-14 text-right tabular-nums"
        />
      </TableCell>
      <TableCell>
        <ThresholdInput knob={rule.warn} value={form.warnText} onChange={form.setWarnText} disabled={form.isPending} />
      </TableCell>
      <TableCell>
        <ThresholdInput knob={rule.crit} value={form.critText} onChange={form.setCritText} disabled={form.isPending} />
      </TableCell>
      <TableCell>
        <Switch checked={form.enabled} onCheckedChange={form.setEnabled} disabled={form.isPending} aria-label="Rule enabled" />
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          {form.dirty && (
            <Button size="sm" className="h-7" onClick={() => form.save()} disabled={form.isPending}>
              Save
            </Button>
          )}
          {rule.config !== null && <ResetRule rule={rule} form={form} />}
        </div>
      </TableCell>
    </TableRow>
  );
}

/** "> 80 %" with the override when there is one, the code default otherwise. */
function knobSummary(knob: RuleKnobView | undefined, text: string): string | null {
  if (!knob) return null;
  const value = text.trim() === "" ? knob.default : text.trim();
  return `${knob.direction === "above" ? ">" : "<"} ${value}${knob.unit ? ` ${knob.unit}` : ""}`;
}

/** The phone version of a row: a summary line that opens the same fields in a drawer. */
function RuleListItem({ rule }: { rule: RuleView }) {
  const form = useRuleForm(rule);
  const [open, setOpen] = useState(false);
  const fieldId = useId();
  const warn = knobSummary(rule.warn, form.warnText);
  const crit = knobSummary(rule.crit, form.critText);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset"
      >
        <div className={cn("min-w-0 flex-1", !form.enabled && "opacity-60")}>
          <p className="text-sm font-medium">{rule.title}</p>
          <code className="block font-mono text-xs break-all text-muted-foreground">{rule.id}</code>
          <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {warn && <span>Warn {warn}</span>}
            {crit && <span>Crit {crit}</span>}
            <span className="font-mono uppercase">{form.effectiveEnvs.join(" ")}</span>
          </p>
          {(rule.config !== null || form.dirty || form.error) && (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {rule.config !== null && (
                <Badge variant="outline" className="font-normal">
                  customized
                </Badge>
              )}
              {form.dirty && (
                <Badge variant="outline" className="border-amber-500/50 font-normal text-amber-700 dark:text-amber-400">
                  not saved
                </Badge>
              )}
              {form.error && <span className="text-xs text-destructive">{form.error}</span>}
            </p>
          )}
        </div>
        <StatusIndicator status={form.enabled ? "ok" : "muted"} label={form.enabled ? "On" : "Off"} className="shrink-0" />
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent>
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>{rule.title}</ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="font-mono text-xs break-all">{rule.id}</ResponsiveDialogDescription>
          </ResponsiveDialogHeader>

          <div className="space-y-5">
            <div className="flex min-h-11 items-center justify-between gap-3">
              <Label htmlFor={`${fieldId}-enabled`} className="text-sm">
                Enabled
              </Label>
              <Switch id={`${fieldId}-enabled`} checked={form.enabled} onCheckedChange={form.setEnabled} disabled={form.isPending} />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Environments</p>
              <EnvToggles form={form} large />
              <p className="text-xs text-muted-foreground">A rule has to run in at least one. Use the switch to turn it off.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${fieldId}-ticks`} className="text-sm">
                For ticks
              </Label>
              <Input
                id={`${fieldId}-ticks`}
                type="number"
                inputMode="numeric"
                value={form.ticksText}
                onChange={(e) => form.setTicksText(e.target.value)}
                placeholder={String(rule.defaultForTicks)}
                disabled={form.isPending}
                className="h-11 text-right tabular-nums"
              />
              <p className="text-xs text-muted-foreground">
                Breaches in a row before it fires, 1 to 10. Empty uses the default of {rule.defaultForTicks}.
              </p>
            </div>

            {rule.warn && (
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-warn`} className="text-sm">
                  Warn
                </Label>
                <ThresholdInput id={`${fieldId}-warn`} knob={rule.warn} value={form.warnText} onChange={form.setWarnText} disabled={form.isPending} large />
              </div>
            )}
            {rule.crit && (
              <div className="space-y-2">
                <Label htmlFor={`${fieldId}-crit`} className="text-sm">
                  Crit
                </Label>
                <ThresholdInput id={`${fieldId}-crit`} knob={rule.crit} value={form.critText} onChange={form.setCritText} disabled={form.isPending} large />
              </div>
            )}

            {form.error && (
              <p className="text-sm text-destructive" role="alert">
                {form.error}
              </p>
            )}
          </div>

          <ResponsiveDialogFooter>
            <Button onClick={() => form.save(() => setOpen(false))} disabled={!form.dirty || form.isPending}>
              {form.isPending ? "Saving…" : "Save"}
            </Button>
            {rule.config !== null && <ResetRule rule={rule} form={form} large onReset={() => setOpen(false)} />}
            <ResponsiveDialogClose asChild>
              <Button variant="ghost">Close</Button>
            </ResponsiveDialogClose>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </li>
  );
}

export function RulesEditor({ rules }: { rules: RuleView[] }) {
  // The table and the list each hold their own form state, so only one may be
  // mounted once the browser has said which screen this is. Until then both
  // are in the markup and CSS shows one, which keeps the first paint right.
  // 1280px, not 768: the seven-column table with its inputs needs the room, and
  // a tablet with the sidebar open doesn't have it.
  const wide = useWideScreen(1280);
  const groups = useMemo(() => {
    const byGroup = new Map<string, RuleView[]>();
    for (const rule of rules) {
      const list = byGroup.get(rule.group) ?? [];
      list.push(rule);
      byGroup.set(rule.group, list);
    }
    return [...byGroup.entries()];
  }, [rules]);

  return (
    <div className="space-y-6">
      {groups.map(([group, groupRules]) => (
        <Card key={group}>
          <CardHeader className="px-4 pb-2 xl:px-6">
            <CardTitle className="text-sm font-medium text-muted-foreground">{group}</CardTitle>
          </CardHeader>
          <CardContent className="px-0 xl:px-6">
            {wide !== false && (
              <div className="hidden xl:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule</TableHead>
                      <TableHead>Envs</TableHead>
                      <TableHead>For ticks</TableHead>
                      <TableHead>Warn</TableHead>
                      <TableHead>Crit</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupRules.map((rule) => (
                      <RuleRow key={rule.id} rule={rule} />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            {wide !== true && (
              <ul className="divide-y xl:hidden">
                {groupRules.map((rule) => (
                  <RuleListItem key={rule.id} rule={rule} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
