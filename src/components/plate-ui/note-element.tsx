import { withRef } from "@udecode/cn";
import { PlateElement } from "@udecode/plate-utils";
import React from "react";

import { useEditor } from "@/hooks/UseWorkflowEditor";
import { cn } from "@/lib/utils";
import { InlineCombobox, InlineComboboxContent, InlineComboboxEmpty, InlineComboboxInput, InlineComboboxItem } from "./inline-combobox";
import { findNodePath } from "@udecode/slate-react";

export const NoteInputElement = withRef<typeof PlateElement>(({ className, ...props }, ref) => {
  const { children, editor, element } = props;
  const [search, setSearch] = React.useState("");

  const {
    state: {
      editor: { parrentNodes },
    },
  } = useEditor();

  const handleSelect = (value: string) => {
    console.log("Selected value:", value);

    // Insert the selected value into the editor
    const path = findNodePath(editor, element);

    console.log("Path:", path);

    editor.insertNode({
      type: "test",

      children: [{ text: value }],
    });

    setSearch("");

    console.log("Editor:", editor.children);
  };

  return (
    <PlateElement as="span" ref={ref} {...props}>
      <InlineCombobox element={element} setValue={setSearch} showTrigger={false} trigger="@" value={search}>
        <span className={cn("*:inline-block rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm ring-ring focus-within:ring-2", className)}>
          <InlineComboboxInput />
        </span>

        <InlineComboboxContent className="my-1.5">
          <InlineComboboxEmpty>No results found</InlineComboboxEmpty>

          {parrentNodes!.map((node) => (
            <InlineComboboxItem key={node.id} value={node.data.title as string} onClick={() => handleSelect(node.data.title as string)}>
              {node.data.title as string}
            </InlineComboboxItem>
          ))}
        </InlineComboboxContent>
      </InlineCombobox>
      {children}
    </PlateElement>
  );
});

// Define a key for your custom combobox input element
export const ELEMENT_CUSTOM_COMBOBOX_INPUT = "custom_combobox_input";
