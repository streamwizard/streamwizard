import type { TMentionElement } from "@udecode/plate-mention";

import { cn, withRef } from "@udecode/cn";
import { PlateElement, getHandler, useElement } from "@udecode/plate-common";
import { useFocused, useSelected } from "slate-react";

export const MentionElement = withRef<
  typeof PlateElement,
  {
    onClick?: (mentionNode: any) => void;
    prefix?: string;
  }
>(({ children, className, onClick, prefix, ...props }, ref) => {
  const element = useElement<TMentionElement>();
  const selected = useSelected();
  const focused = useFocused();

  return (
    <PlateElement
      contentEditable={false}
      className={cn(
        "inline-block cursor-pointer rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm font-medium",
        selected && focused && "ring-2 ring-ring",
        className
      )}
      ref={ref}
      {...props}
    >
      {children}
    </PlateElement>
  );
});

export const ELEMENT_TEST = "test";
