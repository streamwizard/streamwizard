"use client";

import { TriggerComboboxPlugin, withTriggerCombobox } from "@udecode/plate-combobox";
import { createPluginFactory, createPlugins, Plate } from "@udecode/plate-common";
import { Editor } from "./plate-ui/editor";
import { ELEMENT_CUSTOM_COMBOBOX_INPUT, NoteInputElement } from "./plate-ui/note-element";
import { ELEMENT_TEST, MentionElement } from "./plate-ui/mention-element";

// Create the plugin
const createCustomComboboxPlugin = createPluginFactory<TriggerComboboxPlugin>({
  isElement: true,
  isInline: true,
  isMarkableVoid: true,
  // isVoid: true,
  key: ELEMENT_TEST,

  options: {
    createComboboxInput: (trigger) => ({
      children: [{ text: "" }],
      trigger,
      type: ELEMENT_CUSTOM_COMBOBOX_INPUT,
    }),
    // createMentionNode: (item) => ({ value: item.text }),
    trigger: "!",
    triggerPreviousCharPattern: /^\s?$/,
  },

  handlers: {
    
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

// const createTestElementPlugin = createPluginFactory({
//   key: ELEMENT_TEST,
//   isElement: true,
//   isInline: true,
//   isLeaf: true,

// });

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
