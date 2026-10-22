import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { anchorUpdates, type HeadingState } from "@/lib/cms/heading-anchors";

// Gives every heading an anchor that survives rewording, so the links readers
// saved keep working. The rules live in lib/cms/heading-anchors; this only
// reads the document and writes the attribute back.
//
// Hand-rolled rather than an off-the-shelf unique-id extension because
// anchors are unique per *page*, and a guide's intro and sections are
// separate editors. pageOutline settles the page-wide collisions on save.

const key = new PluginKey("cmsHeadingAnchor");

export const HeadingAnchor = Extension.create({
  name: "cmsHeadingAnchor",

  addGlobalAttributes() {
    return [
      {
        types: ["heading"],
        attributes: {
          anchor: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-anchor"),
            renderHTML: (attributes) =>
              attributes.anchor ? { "data-anchor": attributes.anchor as string } : {},
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) return null;

          const { from, to } = newState.selection;
          const headings: HeadingState[] = [];
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== "heading") return;
            headings.push({
              pos,
              text: node.textContent,
              anchor: typeof node.attrs.anchor === "string" ? node.attrs.anchor : null,
              holdsSelection: from <= pos + node.nodeSize && to >= pos,
            });
          });

          const updates = anchorUpdates(headings);
          if (updates.length === 0) return null;

          const transaction = newState.tr;
          for (const update of updates) {
            const node = transaction.doc.nodeAt(update.pos);
            if (!node || node.type.name !== "heading") continue;
            transaction.setNodeMarkup(update.pos, undefined, { ...node.attrs, anchor: update.anchor });
          }
          // Not something to undo on its own: an anchor belongs to the edit
          // that created the heading.
          return transaction.setMeta("addToHistory", false);
        },
      }),
    ];
  },
});
