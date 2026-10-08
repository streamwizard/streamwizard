/*
 * The alert box's enter, exit and highlight effects, as keyframes.
 *
 * Every effect except `wave` and `wiggle` is adapted from animate.css v3.7.2
 * (https://daneden.github.io/animate.css/): vendor prefixes dropped, whitespace
 * collapsed, and each one named under a `sw-fx-` prefix when it is written to
 * the page, so nothing here can meet a streamer's own CSS by name.
 *
 * Version 3.7.2 on purpose. It is the last release under the MIT license; later
 * ones moved to the Hippocratic License.
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2019 Daniel Eden
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/** How an alert, or its text, comes onto the screen. `none` = it is simply there. */
export const ALERT_ENTER_ANIMATIONS = [
  "none",
  "bounce_in",
  "bounce_in_down",
  "bounce_in_up",
  "bounce_in_left",
  "bounce_in_right",
  "fade_in",
  "fade_in_down",
  "fade_in_down_big",
  "fade_in_left",
  "fade_in_left_big",
  "fade_in_right",
  "fade_in_right_big",
  "fade_in_up",
  "fade_in_up_big",
  "flip_in_x",
  "flip_in_y",
  "light_speed_in",
  "rotate_in",
  "rotate_in_down_left",
  "rotate_in_down_right",
  "rotate_in_up_left",
  "rotate_in_up_right",
  "roll_in",
  "zoom_in",
  "zoom_in_left",
  "zoom_in_right",
  "zoom_in_up",
  "zoom_in_down",
  "slide_in_down",
  "slide_in_up",
  "slide_in_left",
  "slide_in_right",
] as const;
export type AlertEnterAnimation = (typeof ALERT_ENTER_ANIMATIONS)[number];

/** How it leaves: the mirror of each enter effect. `none` = it is simply gone. */
export const ALERT_EXIT_ANIMATIONS = [
  "none",
  "bounce_out",
  "bounce_out_down",
  "bounce_out_up",
  "bounce_out_left",
  "bounce_out_right",
  "fade_out",
  "fade_out_down",
  "fade_out_down_big",
  "fade_out_left",
  "fade_out_left_big",
  "fade_out_right",
  "fade_out_right_big",
  "fade_out_up",
  "fade_out_up_big",
  "flip_out_x",
  "flip_out_y",
  "light_speed_out",
  "rotate_out",
  "rotate_out_down_left",
  "rotate_out_down_right",
  "rotate_out_up_left",
  "rotate_out_up_right",
  "roll_out",
  "zoom_out",
  "zoom_out_left",
  "zoom_out_right",
  "zoom_out_up",
  "zoom_out_down",
  "slide_out_down",
  "slide_out_up",
  "slide_out_left",
  "slide_out_right",
] as const;
export type AlertExitAnimation = (typeof ALERT_EXIT_ANIMATIONS)[number];

/** What `{name}` and `{amount}` keep doing for as long as the text shows. */
export const ALERT_HIGHLIGHT_ANIMATIONS = [
  "none",
  "bounce",
  "flash",
  "pulse",
  "rubber_band",
  "tada",
  "wave",
  "wiggle",
  "wobble",
  "swing",
  "shake",
] as const;
export type AlertHighlightAnimation = (typeof ALERT_HIGHLIGHT_ANIMATIONS)[number];

export type AlertEffect = Exclude<
  AlertEnterAnimation | AlertExitAnimation | AlertHighlightAnimation,
  "none"
>;

interface EffectDefinition {
  /** The body of the `@keyframes` rule. */
  keyframes: string;
  /** The easing the effect was drawn with; `ease` when it names none. */
  timing?: string;
  /** Set on the element, not in the keyframes, by the effects that pivot. */
  origin?: string;
  /** The flips need their back face drawn, or half the turn is blank. */
  backface?: boolean;
}

const EFFECTS: Record<AlertEffect, EffectDefinition> = {
  bounce_in: { keyframes: "from,20%,40%,60%,80%,to{animation-timing-function:cubic-bezier(0.215,0.61,0.355,1);} 0%{opacity:0;transform:scale3d(0.3,0.3,0.3);} 20%{transform:scale3d(1.1,1.1,1.1);} 40%{transform:scale3d(0.9,0.9,0.9);} 60%{opacity:1;transform:scale3d(1.03,1.03,1.03);} 80%{transform:scale3d(0.97,0.97,0.97);} to{opacity:1;transform:scale3d(1,1,1);}" },
  bounce_in_down: { keyframes: "from,60%,75%,90%,to{animation-timing-function:cubic-bezier(0.215,0.61,0.355,1);} 0%{opacity:0;transform:translate3d(0,-3000px,0);} 60%{opacity:1;transform:translate3d(0,25px,0);} 75%{transform:translate3d(0,-10px,0);} 90%{transform:translate3d(0,5px,0);} to{transform:translate3d(0,0,0);}" },
  bounce_in_up: { keyframes: "from,60%,75%,90%,to{animation-timing-function:cubic-bezier(0.215,0.61,0.355,1);} from{opacity:0;transform:translate3d(0,3000px,0);} 60%{opacity:1;transform:translate3d(0,-20px,0);} 75%{transform:translate3d(0,10px,0);} 90%{transform:translate3d(0,-5px,0);} to{transform:translate3d(0,0,0);}" },
  bounce_in_left: { keyframes: "from,60%,75%,90%,to{animation-timing-function:cubic-bezier(0.215,0.61,0.355,1);} 0%{opacity:0;transform:translate3d(-3000px,0,0);} 60%{opacity:1;transform:translate3d(25px,0,0);} 75%{transform:translate3d(-10px,0,0);} 90%{transform:translate3d(5px,0,0);} to{transform:translate3d(0,0,0);}" },
  bounce_in_right: { keyframes: "from,60%,75%,90%,to{animation-timing-function:cubic-bezier(0.215,0.61,0.355,1);} from{opacity:0;transform:translate3d(3000px,0,0);} 60%{opacity:1;transform:translate3d(-25px,0,0);} 75%{transform:translate3d(10px,0,0);} 90%{transform:translate3d(-5px,0,0);} to{transform:translate3d(0,0,0);}" },
  fade_in: { keyframes: "from{opacity:0;} to{opacity:1;}" },
  fade_in_down: { keyframes: "from{opacity:0;transform:translate3d(0,-100%,0);} to{opacity:1;transform:translate3d(0,0,0);}" },
  fade_in_down_big: { keyframes: "from{opacity:0;transform:translate3d(0,-2000px,0);} to{opacity:1;transform:translate3d(0,0,0);}" },
  fade_in_left: { keyframes: "from{opacity:0;transform:translate3d(-100%,0,0);} to{opacity:1;transform:translate3d(0,0,0);}" },
  fade_in_left_big: { keyframes: "from{opacity:0;transform:translate3d(-2000px,0,0);} to{opacity:1;transform:translate3d(0,0,0);}" },
  fade_in_right: { keyframes: "from{opacity:0;transform:translate3d(100%,0,0);} to{opacity:1;transform:translate3d(0,0,0);}" },
  fade_in_right_big: { keyframes: "from{opacity:0;transform:translate3d(2000px,0,0);} to{opacity:1;transform:translate3d(0,0,0);}" },
  fade_in_up: { keyframes: "from{opacity:0;transform:translate3d(0,100%,0);} to{opacity:1;transform:translate3d(0,0,0);}" },
  fade_in_up_big: { keyframes: "from{opacity:0;transform:translate3d(0,2000px,0);} to{opacity:1;transform:translate3d(0,0,0);}" },
  flip_in_x: { keyframes: "from{transform:perspective(400px) rotate3d(1,0,0,90deg);animation-timing-function:ease-in;opacity:0;} 40%{transform:perspective(400px) rotate3d(1,0,0,-20deg);animation-timing-function:ease-in;} 60%{transform:perspective(400px) rotate3d(1,0,0,10deg);opacity:1;} 80%{transform:perspective(400px) rotate3d(1,0,0,-5deg);} to{transform:perspective(400px);}", backface: true },
  flip_in_y: { keyframes: "from{transform:perspective(400px) rotate3d(0,1,0,90deg);animation-timing-function:ease-in;opacity:0;} 40%{transform:perspective(400px) rotate3d(0,1,0,-20deg);animation-timing-function:ease-in;} 60%{transform:perspective(400px) rotate3d(0,1,0,10deg);opacity:1;} 80%{transform:perspective(400px) rotate3d(0,1,0,-5deg);} to{transform:perspective(400px);}", backface: true },
  light_speed_in: { keyframes: "from{transform:translate3d(100%,0,0) skewX(-30deg);opacity:0;} 60%{transform:skewX(20deg);opacity:1;} 80%{transform:skewX(-5deg);} to{transform:translate3d(0,0,0);}", timing: "ease-out" },
  rotate_in: { keyframes: "from{transform-origin:center;transform:rotate3d(0,0,1,-200deg);opacity:0;} to{transform-origin:center;transform:translate3d(0,0,0);opacity:1;}" },
  rotate_in_down_left: { keyframes: "from{transform-origin:left bottom;transform:rotate3d(0,0,1,-45deg);opacity:0;} to{transform-origin:left bottom;transform:translate3d(0,0,0);opacity:1;}" },
  rotate_in_down_right: { keyframes: "from{transform-origin:right bottom;transform:rotate3d(0,0,1,45deg);opacity:0;} to{transform-origin:right bottom;transform:translate3d(0,0,0);opacity:1;}" },
  rotate_in_up_left: { keyframes: "from{transform-origin:left bottom;transform:rotate3d(0,0,1,45deg);opacity:0;} to{transform-origin:left bottom;transform:translate3d(0,0,0);opacity:1;}" },
  rotate_in_up_right: { keyframes: "from{transform-origin:right bottom;transform:rotate3d(0,0,1,-90deg);opacity:0;} to{transform-origin:right bottom;transform:translate3d(0,0,0);opacity:1;}" },
  roll_in: { keyframes: "from{opacity:0;transform:translate3d(-100%,0,0) rotate3d(0,0,1,-120deg);} to{opacity:1;transform:translate3d(0,0,0);}" },
  zoom_in: { keyframes: "from{opacity:0;transform:scale3d(0.3,0.3,0.3);} 50%{opacity:1;}" },
  zoom_in_left: { keyframes: "from{opacity:0;transform:scale3d(0.1,0.1,0.1) translate3d(-1000px,0,0);animation-timing-function:cubic-bezier(0.55,0.055,0.675,0.19);} 60%{opacity:1;transform:scale3d(0.475,0.475,0.475) translate3d(10px,0,0);animation-timing-function:cubic-bezier(0.175,0.885,0.32,1);}" },
  zoom_in_right: { keyframes: "from{opacity:0;transform:scale3d(0.1,0.1,0.1) translate3d(1000px,0,0);animation-timing-function:cubic-bezier(0.55,0.055,0.675,0.19);} 60%{opacity:1;transform:scale3d(0.475,0.475,0.475) translate3d(-10px,0,0);animation-timing-function:cubic-bezier(0.175,0.885,0.32,1);}" },
  zoom_in_up: { keyframes: "from{opacity:0;transform:scale3d(0.1,0.1,0.1) translate3d(0,1000px,0);animation-timing-function:cubic-bezier(0.55,0.055,0.675,0.19);} 60%{opacity:1;transform:scale3d(0.475,0.475,0.475) translate3d(0,-60px,0);animation-timing-function:cubic-bezier(0.175,0.885,0.32,1);}" },
  zoom_in_down: { keyframes: "from{opacity:0;transform:scale3d(0.1,0.1,0.1) translate3d(0,-1000px,0);animation-timing-function:cubic-bezier(0.55,0.055,0.675,0.19);} 60%{opacity:1;transform:scale3d(0.475,0.475,0.475) translate3d(0,60px,0);animation-timing-function:cubic-bezier(0.175,0.885,0.32,1);}" },
  slide_in_down: { keyframes: "from{transform:translate3d(0,-100%,0);visibility:visible;} to{transform:translate3d(0,0,0);}" },
  slide_in_up: { keyframes: "from{transform:translate3d(0,100%,0);visibility:visible;} to{transform:translate3d(0,0,0);}" },
  slide_in_left: { keyframes: "from{transform:translate3d(-100%,0,0);visibility:visible;} to{transform:translate3d(0,0,0);}" },
  slide_in_right: { keyframes: "from{transform:translate3d(100%,0,0);visibility:visible;} to{transform:translate3d(0,0,0);}" },
  bounce_out: { keyframes: "20%{transform:scale3d(0.9,0.9,0.9);} 50%,55%{opacity:1;transform:scale3d(1.1,1.1,1.1);} to{opacity:0;transform:scale3d(0.3,0.3,0.3);}" },
  bounce_out_down: { keyframes: "20%{transform:translate3d(0,10px,0);} 40%,45%{opacity:1;transform:translate3d(0,-20px,0);} to{opacity:0;transform:translate3d(0,2000px,0);}" },
  bounce_out_up: { keyframes: "20%{transform:translate3d(0,-10px,0);} 40%,45%{opacity:1;transform:translate3d(0,20px,0);} to{opacity:0;transform:translate3d(0,-2000px,0);}" },
  bounce_out_left: { keyframes: "20%{opacity:1;transform:translate3d(20px,0,0);} to{opacity:0;transform:translate3d(-2000px,0,0);}" },
  bounce_out_right: { keyframes: "20%{opacity:1;transform:translate3d(-20px,0,0);} to{opacity:0;transform:translate3d(2000px,0,0);}" },
  fade_out: { keyframes: "from{opacity:1;} to{opacity:0;}" },
  fade_out_down: { keyframes: "from{opacity:1;} to{opacity:0;transform:translate3d(0,100%,0);}" },
  fade_out_down_big: { keyframes: "from{opacity:1;} to{opacity:0;transform:translate3d(0,2000px,0);}" },
  fade_out_left: { keyframes: "from{opacity:1;} to{opacity:0;transform:translate3d(-100%,0,0);}" },
  fade_out_left_big: { keyframes: "from{opacity:1;} to{opacity:0;transform:translate3d(-2000px,0,0);}" },
  fade_out_right: { keyframes: "from{opacity:1;} to{opacity:0;transform:translate3d(100%,0,0);}" },
  fade_out_right_big: { keyframes: "from{opacity:1;} to{opacity:0;transform:translate3d(2000px,0,0);}" },
  fade_out_up: { keyframes: "from{opacity:1;} to{opacity:0;transform:translate3d(0,-100%,0);}" },
  fade_out_up_big: { keyframes: "from{opacity:1;} to{opacity:0;transform:translate3d(0,-2000px,0);}" },
  flip_out_x: { keyframes: "from{transform:perspective(400px);} 30%{transform:perspective(400px) rotate3d(1,0,0,-20deg);opacity:1;} to{transform:perspective(400px) rotate3d(1,0,0,90deg);opacity:0;}", backface: true },
  flip_out_y: { keyframes: "from{transform:perspective(400px);} 30%{transform:perspective(400px) rotate3d(0,1,0,-15deg);opacity:1;} to{transform:perspective(400px) rotate3d(0,1,0,90deg);opacity:0;}", backface: true },
  light_speed_out: { keyframes: "from{opacity:1;} to{transform:translate3d(100%,0,0) skewX(30deg);opacity:0;}", timing: "ease-in" },
  rotate_out: { keyframes: "from{transform-origin:center;opacity:1;} to{transform-origin:center;transform:rotate3d(0,0,1,200deg);opacity:0;}" },
  rotate_out_down_left: { keyframes: "from{transform-origin:left bottom;opacity:1;} to{transform-origin:left bottom;transform:rotate3d(0,0,1,45deg);opacity:0;}" },
  rotate_out_down_right: { keyframes: "from{transform-origin:right bottom;opacity:1;} to{transform-origin:right bottom;transform:rotate3d(0,0,1,-45deg);opacity:0;}" },
  rotate_out_up_left: { keyframes: "from{transform-origin:left bottom;opacity:1;} to{transform-origin:left bottom;transform:rotate3d(0,0,1,-45deg);opacity:0;}" },
  rotate_out_up_right: { keyframes: "from{transform-origin:right bottom;opacity:1;} to{transform-origin:right bottom;transform:rotate3d(0,0,1,90deg);opacity:0;}" },
  roll_out: { keyframes: "from{opacity:1;} to{opacity:0;transform:translate3d(100%,0,0) rotate3d(0,0,1,120deg);}" },
  zoom_out: { keyframes: "from{opacity:1;} 50%{opacity:0;transform:scale3d(0.3,0.3,0.3);} to{opacity:0;}" },
  zoom_out_left: { keyframes: "40%{opacity:1;transform:scale3d(0.475,0.475,0.475) translate3d(42px,0,0);} to{opacity:0;transform:scale(0.1) translate3d(-2000px,0,0);transform-origin:left center;}" },
  zoom_out_right: { keyframes: "40%{opacity:1;transform:scale3d(0.475,0.475,0.475) translate3d(-42px,0,0);} to{opacity:0;transform:scale(0.1) translate3d(2000px,0,0);transform-origin:right center;}" },
  zoom_out_up: { keyframes: "40%{opacity:1;transform:scale3d(0.475,0.475,0.475) translate3d(0,60px,0);animation-timing-function:cubic-bezier(0.55,0.055,0.675,0.19);} to{opacity:0;transform:scale3d(0.1,0.1,0.1) translate3d(0,-2000px,0);transform-origin:center bottom;animation-timing-function:cubic-bezier(0.175,0.885,0.32,1);}" },
  zoom_out_down: { keyframes: "40%{opacity:1;transform:scale3d(0.475,0.475,0.475) translate3d(0,-60px,0);animation-timing-function:cubic-bezier(0.55,0.055,0.675,0.19);} to{opacity:0;transform:scale3d(0.1,0.1,0.1) translate3d(0,2000px,0);transform-origin:center bottom;animation-timing-function:cubic-bezier(0.175,0.885,0.32,1);}" },
  slide_out_down: { keyframes: "from{transform:translate3d(0,0,0);} to{visibility:hidden;transform:translate3d(0,100%,0);}" },
  slide_out_up: { keyframes: "from{transform:translate3d(0,0,0);} to{visibility:hidden;transform:translate3d(0,-100%,0);}" },
  slide_out_left: { keyframes: "from{transform:translate3d(0,0,0);} to{visibility:hidden;transform:translate3d(-100%,0,0);}" },
  slide_out_right: { keyframes: "from{transform:translate3d(0,0,0);} to{visibility:hidden;transform:translate3d(100%,0,0);}" },
  bounce: { keyframes: "from,20%,53%,80%,to{animation-timing-function:cubic-bezier(0.215,0.61,0.355,1);transform:translate3d(0,0,0);} 40%,43%{animation-timing-function:cubic-bezier(0.755,0.05,0.855,0.06);transform:translate3d(0,-30px,0);} 70%{animation-timing-function:cubic-bezier(0.755,0.05,0.855,0.06);transform:translate3d(0,-15px,0);} 90%{transform:translate3d(0,-4px,0);}", origin: "center bottom" },
  flash: { keyframes: "from,50%,to{opacity:1;} 25%,75%{opacity:0;}" },
  pulse: { keyframes: "from{transform:scale3d(1,1,1);} 50%{transform:scale3d(1.05,1.05,1.05);} to{transform:scale3d(1,1,1);}" },
  rubber_band: { keyframes: "from{transform:scale3d(1,1,1);} 30%{transform:scale3d(1.25,0.75,1);} 40%{transform:scale3d(0.75,1.25,1);} 50%{transform:scale3d(1.15,0.85,1);} 65%{transform:scale3d(0.95,1.05,1);} 75%{transform:scale3d(1.05,0.95,1);} to{transform:scale3d(1,1,1);}" },
  tada: { keyframes: "from{transform:scale3d(1,1,1);} 10%,20%{transform:scale3d(0.9,0.9,0.9) rotate3d(0,0,1,-3deg);} 30%,50%,70%,90%{transform:scale3d(1.1,1.1,1.1) rotate3d(0,0,1,3deg);} 40%,60%,80%{transform:scale3d(1.1,1.1,1.1) rotate3d(0,0,1,-3deg);} to{transform:scale3d(1,1,1);}" },
  wave: { keyframes: "0%,60%,100%{transform:translate3d(0,0,0)}30%{transform:translate3d(0,-0.3em,0)}", timing: "ease-in-out" },
  wiggle: { keyframes: "0%,100%{transform:rotate3d(0,0,1,0deg)}25%{transform:rotate3d(0,0,1,-6deg)}75%{transform:rotate3d(0,0,1,6deg)}", timing: "ease-in-out" },
  wobble: { keyframes: "from{transform:translate3d(0,0,0);} 15%{transform:translate3d(-25%,0,0) rotate3d(0,0,1,-5deg);} 30%{transform:translate3d(20%,0,0) rotate3d(0,0,1,3deg);} 45%{transform:translate3d(-15%,0,0) rotate3d(0,0,1,-3deg);} 60%{transform:translate3d(10%,0,0) rotate3d(0,0,1,2deg);} 75%{transform:translate3d(-5%,0,0) rotate3d(0,0,1,-1deg);} to{transform:translate3d(0,0,0);}" },
  swing: { keyframes: "20%{transform:rotate3d(0,0,1,15deg);} 40%{transform:rotate3d(0,0,1,-10deg);} 60%{transform:rotate3d(0,0,1,5deg);} 80%{transform:rotate3d(0,0,1,-5deg);} to{transform:rotate3d(0,0,1,0deg);}", origin: "top center" },
  shake: { keyframes: "from,to{transform:translate3d(0,0,0);} 10%,30%,50%,70%,90%{transform:translate3d(-10px,0,0);} 20%,40%,60%,80%{transform:translate3d(10px,0,0);}" },
};

const keyframeName = (effect: AlertEffect) => `sw-fx-${effect.replaceAll("_", "-")}`;

/**
 * The `@keyframes` rules for a set of effects, to put in a `<style>`. Only the
 * ones asked for: an alert uses five at most, and there are seventy-six.
 */
export function alertEffectKeyframes(effects: readonly (AlertEffect | "none")[]): string {
  return [...new Set(effects)]
    .filter((effect): effect is AlertEffect => effect !== "none" && effect in EFFECTS)
    .map((effect) => `@keyframes ${keyframeName(effect)}{${EFFECTS[effect].keyframes}}`)
    .join("\n");
}

export interface AlertEffectStyle {
  animation: string;
  transformOrigin?: string;
  backfaceVisibility?: "visible";
}

/**
 * The inline style that plays one effect, or null when there is nothing to
 * play: `none`, or no time to play it in. An enter or exit runs once and holds
 * its last frame; a highlight loops.
 */
export function alertEffectStyle(
  effect: AlertEffect | "none",
  durationMs: number,
  loop = false
): AlertEffectStyle | null {
  if (effect === "none" || !(effect in EFFECTS) || !(durationMs > 0)) return null;
  const definition = EFFECTS[effect];
  return {
    animation: `${keyframeName(effect)} ${Math.round(durationMs)}ms ${definition.timing ?? "ease"} ${
      loop ? "infinite" : "both"
    }`,
    ...(definition.origin ? { transformOrigin: definition.origin } : {}),
    ...(definition.backface ? { backfaceVisibility: "visible" as const } : {}),
  };
}
