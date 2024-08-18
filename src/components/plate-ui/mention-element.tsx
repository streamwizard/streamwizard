import React, { useEffect } from "react";

import type { TMentionElement } from "@udecode/plate-mention";

import { cn, withRef } from "@udecode/cn";
import { PlateElement, getHandler, useElement } from "@udecode/plate-common";
import { useFocused, useSelected } from "slate-react";
import { findNodePath } from "@udecode/slate-react";

export const MentionElement = withRef<
  typeof PlateElement,
  {
    onClick?: (mentionNode: any) => void;
    prefix?: string;
    renderLabel?: (mentionable: TMentionElement) => string;
  }
>(({ children, className, onClick, prefix, renderLabel, ...props }, ref) => {
  const element = useElement<TMentionElement>();
  const selected = useSelected();
  const focused = useFocused();
  const { editor } = props;

  onkeydown = (e) => {
    if (e.key === "Backspace" && selected) {
      e.preventDefault();
      const path = findNodePath(editor, element);

      editor.removeNodes({ at: path });
    }
  };

  return (
    <PlateElement
      className={cn(
        "inline-block cursor-pointer rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm font-medium",
        selected && focused && "ring-2 ring-ring",
        className
      )}
      contentEditable={false}
      data-slate-value={element.value}
      onClick={getHandler(onClick, element)}
      ref={ref}
      {...props}
    >
      {prefix}
      {renderLabel ? renderLabel(element) : element.value}
      {children}
    </PlateElement>
  );
});

export const ELEMENT_TEST = "test";
