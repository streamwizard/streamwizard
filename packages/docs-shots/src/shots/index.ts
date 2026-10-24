import type { Shot } from "../manifest";
import { dashboardShots } from "./dashboard";
import { overlayWidgetShots } from "./overlay-widgets";

export const SHOTS: Shot[] = [...overlayWidgetShots, ...dashboardShots];
