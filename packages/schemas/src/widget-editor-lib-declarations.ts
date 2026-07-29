// Hand-written Monaco extra-lib declarations for the widget editor, covering
// the libraries and globals the srcdoc sandbox injects (see buildWidgetSrcdoc
// in @repo/ui). The Twitch event catalog lives in widget-editor-declarations.ts
// (generated - do not merge these into that file, it gets overwritten).

export const GSAP_DECLARATIONS = `
interface GSAPTweenVars {
  duration?: number;
  delay?: number;
  ease?: string;
  opacity?: number;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  width?: number | string;
  height?: number | string;
  backgroundColor?: string;
  color?: string;
  fontSize?: number | string;
  repeat?: number;
  yoyo?: boolean;
  stagger?: number | object;
  onComplete?: () => void;
  onStart?: () => void;
  onUpdate?: () => void;
  [key: string]: any;
}

interface GSAPTimeline {
  to(targets: any, vars: GSAPTweenVars, position?: number | string): GSAPTimeline;
  from(targets: any, vars: GSAPTweenVars, position?: number | string): GSAPTimeline;
  fromTo(targets: any, fromVars: GSAPTweenVars, toVars: GSAPTweenVars, position?: number | string): GSAPTimeline;
  add(child: any, position?: number | string): GSAPTimeline;
  play(): GSAPTimeline;
  pause(): GSAPTimeline;
  reverse(): GSAPTimeline;
  restart(): GSAPTimeline;
  kill(): void;
  duration(): number;
  progress(value?: number): GSAPTimeline | number;
  repeat(value?: number): GSAPTimeline | number;
  delay(value?: number): GSAPTimeline | number;
}

interface GSAP {
  to(targets: any, vars: GSAPTweenVars): object;
  from(targets: any, vars: GSAPTweenVars): object;
  fromTo(targets: any, fromVars: GSAPTweenVars, toVars: GSAPTweenVars): object;
  set(targets: any, vars: GSAPTweenVars): object;
  timeline(vars?: GSAPTweenVars): GSAPTimeline;
  registerPlugin(...plugins: any[]): void;
  killTweensOf(targets: any): void;
  delayedCall(delay: number, callback: () => void): object;
  utils: {
    clamp(min: number, max: number, value: number): number;
    mapRange(inMin: number, inMax: number, outMin: number, outMax: number, value: number): number;
    interpolate(start: any, end: any, progress: number): any;
  };
}

declare const gsap: GSAP;

interface TextPlugin {
  text?: string | { value: string; delimiter?: string };
}
`;

export const STREAMWIZARD_RUNTIME_DECLARATIONS = `
interface StreamWizardSession {
  subscriberToken: string;
  overlayItemId: string;
}

interface StreamWizardStateApi {
  /**
   * Loads this widget instance's persisted state (or null when nothing was
   * saved yet). Only available when the widget is placed on an overlay -
   * throws in the editor preview.
   */
  get(): Promise<any | null>;
  /**
   * Persists this widget instance's state. Overwrites the previous value;
   * spread the old state if you want to merge. Only available when the
   * widget is placed on an overlay - throws in the editor preview.
   */
  set(state: Record<string, any>): Promise<void>;
}

interface StreamWizardGlobal {
  /** Base URL of the raw state API; prefer StreamWizard.state.get/set. */
  stateUrl: string | null;
  /** Set from onWidgetLoad; null until then or in the editor preview. */
  session: StreamWizardSession | null;
  state: StreamWizardStateApi;
}

declare const StreamWizard: StreamWizardGlobal;

interface Window {
  StreamWizard: StreamWizardGlobal;
}
`;

/** All hand-written extra libs, ready to feed to Monaco alongside the generated event catalog. */
export const WIDGET_EDITOR_LIB_DECLARATIONS = GSAP_DECLARATIONS + STREAMWIZARD_RUNTIME_DECLARATIONS;
