"use client";

import { useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { LucideIcon } from "lucide-react";

interface QuickActionButtonProps {
  icon: LucideIcon;
  label: string;
  onClick?: () => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
  successMessage?: string;
  errorMessage?: string;
}

export function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  disabledReason,
  successMessage,
  errorMessage,
}: QuickActionButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!onClick || disabled) return;
    startTransition(async () => {
      try {
        await onClick();
        if (successMessage) toast.success(successMessage);
      } catch (err) {
        toast.error(errorMessage ?? (err instanceof Error ? err.message : "Something went wrong"));
      }
    });
  }

  const isDisabled = disabled || isPending;

  return (
    <button
      onClick={handleClick}
      disabled={isDisabled}
      title={disabled && disabledReason ? disabledReason : undefined}
      className="flex flex-col items-center gap-1.5 rounded-lg border bg-card p-3 text-xs font-medium transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      ) : (
        <Icon className="h-5 w-5" />
      )}
      <span>{label}</span>
    </button>
  );
}
