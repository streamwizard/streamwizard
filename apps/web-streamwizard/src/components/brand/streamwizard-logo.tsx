import type { CSSProperties, HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type StreamWizardLogoProps = HTMLAttributes<HTMLSpanElement> & {
  width?: number;
  height?: number;
  priority?: boolean;
};

const logoMaskStyle = {
  WebkitMaskImage: "url(/logo.png)",
  WebkitMaskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  WebkitMaskSize: "contain",
  maskImage: "url(/logo.png)",
  maskRepeat: "no-repeat",
  maskPosition: "center",
  maskSize: "contain",
} satisfies CSSProperties;

export function StreamWizardLogo({
  className,
  width = 160,
  height = 160,
  style,
  priority: _priority,
  ...props
}: StreamWizardLogoProps) {
  return (
    <span
      role="img"
      aria-label="StreamWizard"
      className={cn("inline-block shrink-0 bg-current text-sidebar-foreground", className)}
      style={{ width, height, ...logoMaskStyle, ...style }}
      {...props}
    />
  );
}
