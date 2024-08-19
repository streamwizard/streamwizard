"use client";

import { TriggerComboboxPlugin } from "@udecode/plate-combobox";
import { createPluginFactory, createPlugins, Plate } from "@udecode/plate-common";
import { Editor } from "./plate-ui/editor";
import { ELEMENT_CUSTOM_COMBOBOX_INPUT, NoteInputElement } from "./plate-ui/note-element";
import { ELEMENT_TEST, MentionElement } from "./plate-ui/mention-element";

import type { TElement, TNodeProps } from "@udecode/plate-common";
import { withTriggerCombobox } from "./plate-ui/custom-plugin";

export interface TMentionItemBase {
  text: string;
}

export interface TMentionInputElement extends TElement {
  trigger: string;
}

export interface TMentionElement extends TElement {
  data: {
    node_id: string;
    label: string;
    variable?: string;
  };
}

export interface MentionPlugin<TItem extends TMentionItemBase = TMentionItemBase> extends TriggerComboboxPlugin {
  createMentionNode?: (item: TItem, search: string) => TNodeProps<TMentionElement>;
  insertSpaceAfterMention?: boolean;
}

const createCustomComboboxPlugin = createPluginFactory<MentionPlugin>({
  isElement: true,
  isInline: true,
  isVoid: true,
  key: ELEMENT_TEST,

  options: {
    createComboboxInput: (trigger) => ({
      children: [{ text: "" }],
      trigger,
      closeOnSelect: false,
      type: ELEMENT_CUSTOM_COMBOBOX_INPUT,
    }),

    trigger: "!",
    triggerPreviousCharPattern: /^\s?$/,
    insertSpaceAfterMention: true,
    createMentionNode: (item) => ({
      children: [{ text: item.text }],
      value: item.text,
    }),
  },

  plugins: [
    {
      isElement: true,
      isInline: true,
      isVoid: true,
      key: ELEMENT_CUSTOM_COMBOBOX_INPUT,
    },
  ],

  withOverrides: withTriggerCombobox,

});

const plugins = createPlugins([createCustomComboboxPlugin()], {
  components: {
    [ELEMENT_CUSTOM_COMBOBOX_INPUT]: NoteInputElement,
    [ELEMENT_TEST]: MentionElement,
  },
});

const initialValue = [
  {
    id: "1",
    type: "p",
    children: [{ text: "Hello, World!" }],
  },
];

export default function PlateEditor() {
  return (
    <Plate plugins={plugins} initialValue={initialValue}>
      <Editor />
    </Plate>
  );
}
