"use client";

import type { VariableDefinition } from "@repo/discord-message";
import { DISCORD } from "./discord-styles";
import { parseRichText, type RichNode } from "./rich-text";

function VariableChip({ node, variables }: { node: Extract<RichNode, { type: "variable" }>; variables: VariableDefinition[] }) {
  const known = variables.find((v) => v.key === node.key);
  return (
    <span
      title={known ? `Becomes something like "${known.sample}"` : "Not a variable here. Discord would show it as typed."}
      className="mx-px inline-block rounded px-1 align-baseline text-[0.92em] font-medium leading-[1.3]"
      style={known ? { backgroundColor: "rgba(88,101,242,0.3)", color: "#c9cdfb" } : { backgroundColor: "rgba(242,63,67,0.25)", color: "#ffb3b5" }}
    >
      {known ? known.label : node.raw}
    </span>
  );
}

type LinkNode = Extract<RichNode, { type: "link" }>;

interface NodeProps {
  node: RichNode;
  variables: VariableDefinition[];
  /** Masked links numbered in text order, when they can be clicked. */
  links?: { order: Map<LinkNode, number>; onClick: (index: number) => void };
}

function numberLinks(nodes: RichNode[], order = new Map<LinkNode, number>()): Map<LinkNode, number> {
  for (const node of nodes) {
    if (node.type === "link" && node.masked) order.set(node, order.size);
    if ("children" in node) numberLinks(node.children, order);
  }
  return order;
}

function Node({ node, variables, links }: NodeProps) {
  const children =
    "children" in node ? node.children.map((child, i) => <Node key={i} node={child} variables={variables} links={links} />) : null;
  switch (node.type) {
    case "text":
      return <>{node.value}</>;
    case "variable":
      return <VariableChip node={node} variables={variables} />;
    case "code":
      return (
        <code className="rounded px-1 py-px text-[0.85em]" style={{ backgroundColor: DISCORD.code }}>
          {node.value}
        </code>
      );
    case "link": {
      // Not a real link: clicking text in the builder edits it, and a masked link opens the link menu.
      const index = links?.order.get(node);
      if (!links || index === undefined) return <span style={{ color: DISCORD.link }}>{children}</span>;
      return (
        <span
          title={`${node.href}\nClick to change`}
          className="cursor-pointer hover:underline"
          style={{ color: DISCORD.link }}
          // Keeps focus where it is, so the text around the link doesn't open for typing.
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            links.onClick(index);
          }}
        >
          {children}
        </span>
      );
    }
    case "bold":
      return <strong className="font-semibold">{children}</strong>;
    case "italic":
      return <em>{children}</em>;
    case "underline":
      return <u>{children}</u>;
    case "strike":
      return <s>{children}</s>;
  }
}

/** Discord-flavoured text with placeholders as chips. */
export function RichTextView({
  text,
  variables,
  onLinkClick,
}: {
  text: string;
  variables: VariableDefinition[];
  /** Called with the position of the masked link among the text's masked links. */
  onLinkClick?: (index: number) => void;
}) {
  const nodes = parseRichText(text);
  const links = onLinkClick ? { order: numberLinks(nodes), onClick: onLinkClick } : undefined;
  return (
    <>
      {nodes.map((node, i) => (
        <Node key={i} node={node} variables={variables} links={links} />
      ))}
    </>
  );
}
