import type { Shot } from "../manifest";
import { dashboardShots } from "./dashboard";
import { overlayWidgetShots } from "./overlay-widgets";
import { vodShots } from "./vods";

export const SHOTS: Shot[] = [...overlayWidgetShots, ...dashboardShots, ...vodShots];
