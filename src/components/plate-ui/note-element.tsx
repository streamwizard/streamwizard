import { useEditor } from "@/hooks/UseWorkflowEditor";
import { cn } from "@/lib/utils";
import { withRef } from "@udecode/cn";
import { getBlockAbove, insertNodes, insertText, isEndPoint, moveSelection } from "@udecode/plate-common/server";
import { PlateElement } from "@udecode/plate-utils";
import React from "react";
import { InlineCombobox, InlineComboboxContent, InlineComboboxEmpty, InlineComboboxInput, InlineComboboxItem } from "./inline-combobox";
import { ELEMENT_TEST } from "./mention-element";


const frameworks = [
  {
    value: "next.js",
    label: "Next.js",
  },
  {
    value: "sveltekit",
    label: "SvelteKit",
  },
  {
    value: "nuxt.js",
    label: "Nuxt.js",
  },
  {
    value: "remix",
    label: "Remix",
  },
  {
    value: "astro",
    label: "Astro",
  },
]

export const NoteInputElement = withRef<typeof PlateElement>(({ className, ...props }, ref) => {
  const { children, editor, element } = props;
  const [search, setSearch] = React.useState("");
  const [secondArray, setSecondArray] = React.useState<string[]>([]);
  const [open, setOpen] = React.useState(true);
  
  const {
    state: {
      editor: { parentNodes },
    },
  } = useEditor();

  const handleSelect = (item: { id: string; label: string }) => {
    console.log("Selected value:", item.label);

    insertNodes(editor, {
      type: ELEMENT_TEST,
      children: [{ text: item.label }],
      id: item.id,
      data: {
        node_id: item.id,
        label: item.label,
      }
    });

    moveSelection(editor, { distance: 1 });



    // Reset combobox for new values
    setSearch("");
    setSecondArray(["New Value 1", "New Value 2", "New Value 3"]);
  };

  return (
    <PlateElement as="span" ref={ref} {...props}>
      <InlineCombobox element={element} setValue={setSearch} showTrigger={false} trigger="!" value={search} >
        <span className={cn("inline-block rounded-md bg-muted px-1.5 py-0.5 align-baseline text-sm ring-ring focus-within:ring-2", className)}>
          <InlineComboboxInput />
        </span>
        <InlineComboboxContent className="my-1.5">
          <InlineComboboxEmpty>No results found</InlineComboboxEmpty>
          {secondArray.length > 0 ? (
            secondArray.map((value, index) => (
              <InlineComboboxItem 
                key={index} 
                value={value} 
                // onClick={() => handleSelect({ id: String(index), label: value })}
              >
                {value}
              </InlineComboboxItem>
            ))
          ) : (
            parentNodes && parentNodes.length > 0 ? (
              parentNodes.map((node) => (
                <InlineComboboxItem 
                  key={node.id} 
                  value={node.data.title as string} 
                  onClick={() => handleSelect({ id: node.id, label: node.data.title as string })}
                >
                  {node.data.title as string}
                </InlineComboboxItem>
              ))
            ) : (
              <InlineComboboxEmpty>No parent nodes available</InlineComboboxEmpty>
            )
          )}
        </InlineComboboxContent>
      </InlineCombobox>
      {children}
    </PlateElement>
  );
});


export const ELEMENT_CUSTOM_COMBOBOX_INPUT = "custom_combobox_input";