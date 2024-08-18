"use client";

import { TriggerComboboxPlugin, withTriggerCombobox } from "@udecode/plate-combobox";
import { createPluginFactory, createPlugins, Plate } from "@udecode/plate-common";
import { Editor } from "./plate-ui/editor";
import { ELEMENT_CUSTOM_COMBOBOX_INPUT, NoteInputElement } from "./plate-ui/note-element";
import { ELEMENT_TEST, MentionElement } from "./plate-ui/mention-element";
import { ELEMENT_MENTION } from "@udecode/plate-mention";

// Create the plugin
const createCustomComboboxPlugin = createPluginFactory<TriggerComboboxPlugin>({
  key: "customCombobox",
  withOverrides: withTriggerCombobox,
  options: {
    trigger: "!", // Use '!' as the trigger character
    triggerPreviousCharPattern: /^\s?$/, // Trigger after space or at start of line
    createComboboxInput: (trigger) => ({
      type: ELEMENT_CUSTOM_COMBOBOX_INPUT,
      children: [{ text: "" }],
      trigger,
    }),
  },

  plugins: [
    {
      key: ELEMENT_CUSTOM_COMBOBOX_INPUT,
      isElement: true,
      isInline: true,
      isVoid: true,
    },
  ],
});

const createTestElementPlugin = createPluginFactory({
  key: ELEMENT_TEST,
  isElement: true,
  isInline: true,
  

});


const plugins = createPlugins([createCustomComboboxPlugin(), createTestElementPlugin()], {
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
