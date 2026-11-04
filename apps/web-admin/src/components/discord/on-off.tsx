export function OnOff({ on }: { on: boolean }) {
  return <span className={on ? undefined : "text-muted-foreground"}>{on ? "On" : "Off"}</span>;
}
