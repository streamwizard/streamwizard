import type { ClipNestedDisplayFieldDefinition } from "../types";

export const gameField: ClipNestedDisplayFieldDefinition<"game"> = {
  key: "game",
  label: "Game",
  formatPreviewText: (clip) => clip?.game_name ?? "",
};
