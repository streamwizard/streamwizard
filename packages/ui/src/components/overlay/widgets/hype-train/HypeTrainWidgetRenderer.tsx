"use client";

// Next.js replaces NEXT_PUBLIC_* at build time; declare process so tsc is happy in this library package.
declare const process: { env: Record<string, string | undefined> };

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useGoogleFonts } from "../../hooks/use-google-font";
import { subscribeToWsRoom } from "../../lib/ws-store";
import type { OverlayItem, OverlayScene } from "../../types";
import {
  ALERT_TEST_BROWSER_EVENT,
  type AlertTestBrowserEventDetail,
} from "../alert/alert-widget-config";
import {
  HYPE_TRAIN_PREVIEW_EVENT,
  hypeTrainSpeed,
  normalizeHypeTrainWidgetConfig,
  type HypeTrainPreviewDetail,
  type HypeTrainWidgetItemConfig,
} from "./hype-train-widget-config";
import {
  EMPTY_HYPE_TRAIN_STATE,
  HYPE_TRAIN_EXPIRY_GRACE_MS,
  applyAvatars,
  applyHypeTrainFrame,
  expireHypeTrain,
  formatRiderAmount,
  hypeTrainGone,
  rankRiders,
  type HypeTrainFrame,
  type HypeTrainRider,
  type HypeTrainState,
  type RankedRider,
} from "./hype-train-engine";
import {
  JOIN_EFFECT_MS,
  createAcrossMotion,
  createBounceMotion,
  joinPose,
  overtakeLift,
  offBox,
  placeCar,
  pointsAlongTrail,
  stepBounceMotion,
  type BounceBox,
  type BounceMotion,
} from "./hype-train-motion";
import {
  CABOOSE_W,
  COUPLER_W,
  Caboose,
  Coupler,
  HYPE_TRAIN_KEYFRAMES,
  LOCO_W,
  Locomotive,
  TRAIN_H,
  WAGON_W,
  Wagon,
  trainDesignWidth,
  trainPaint,
} from "./hype-train-parts";

export interface HypeTrainWidgetRendererProps {
  item: OverlayItem;
  scene?: OverlayScene;
  isEditor?: boolean;
}

/** Wheel radius the spin speed is matched to, in design px. */
const SPIN_RADIUS = 20;

/**
 * Real Twitch ids only. The test fixtures use tiny ids ("1", "11") that belong
 * to real, unrelated accounts, and demo riders use non-numeric ids, so neither
 * gets someone else's face.
 */
const FETCHABLE_ID = /^\d{3,}$/;

function sampleRider(id: string, name: string, bits: number, subs: number): HypeTrainRider {
  return { id, login: name.toLowerCase(), name, avatar: null, bits, subs, subPoints: subs * 500, other: 0, joinedAt: 0 };
}

/** The parked train in the editor. */
const PARKED_RIDERS: HypeTrainRider[] = [
  sampleRider("sample-1", "PixelPenguin", 2500, 0),
  sampleRider("sample-2", "sandwichlord", 0, 10),
  sampleRider("sample-3", "NightOwlNia", 800, 1),
];

/** Preview: a short sample train, with riders joining on the way. */
const PREVIEW_MS = 14_000;
const PREVIEW_START = [
  { user_id: "sample-1", user_login: "pixelpenguin", user_name: "PixelPenguin", type: "bits", total: 2500 },
  { user_id: "sample-2", user_login: "sandwichlord", user_name: "sandwichlord", type: "subscription", total: 5000 },
  { user_id: "sample-3", user_login: "nightowlnia", user_name: "NightOwlNia", type: "bits", total: 800 },
];
const PREVIEW_JOINERS = [
  { at: 3000, name: "CozyCactus", bits: 300 },
  { at: 6000, name: "TurboTaco", bits: 1200 },
  { at: 9000, name: "LunaLoops", bits: 100 },
];

function useBoxSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // offsetWidth ignores the editor's zoom transform, so this is in scene px.
    const measure = () =>
      setSize((s) => (s.w === el.offsetWidth && s.h === el.offsetHeight ? s : { w: el.offsetWidth, h: el.offsetHeight }));
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

interface Car {
  key: string;
  /** Design px. */
  width: number;
  node: ReactNode;
}

/** Loco first, then riders biggest supporter first, the overflow in one "+N more" car. */
function buildCars(
  cfg: HypeTrainWidgetItemConfig,
  riders: readonly RankedRider[],
  level: number,
  trainType: string,
  mirror: boolean,
): Car[] {
  const paint = trainPaint(cfg.trainColor, cfg.accentColor, trainType);
  const shown = riders.slice(0, cfg.maxWagons);
  const more = riders.length - shown.length;
  const cars: Car[] = [
    {
      key: "loco",
      width: LOCO_W,
      node: (
        <Locomotive
          preset={cfg.preset}
          paint={paint}
          mirror={mirror}
          level={level}
          showLevel={cfg.showLevel}
          color={cfg.color}
        />
      ),
    },
  ];
  shown.forEach(({ rider: r, joinIndex }) => {
    cars.push({
      key: r.id,
      width: WAGON_W,
      node: (
        <Wagon
          preset={cfg.preset}
          paint={paint}
          mirror={mirror}
          index={joinIndex}
          name={r.name || r.login}
          amount={cfg.showAmounts ? formatRiderAmount(r) : ""}
          avatar={r.avatar}
          showAvatar={cfg.showAvatars}
          color={cfg.color}
        />
      ),
    });
  });
  if (more > 0) {
    cars.push({
      key: "more",
      width: CABOOSE_W,
      node: <Caboose preset={cfg.preset} paint={paint} mirror={mirror} index={riders.length} more={more} color={cfg.color} />,
    });
  }
  return cars;
}

/** The cars in one straight row, coupled: the parked train in the editor. */
function TrainRow({
  cfg,
  riders,
  level,
  trainType,
  mirror,
}: {
  cfg: HypeTrainWidgetItemConfig;
  riders: readonly HypeTrainRider[];
  level: number;
  trainType: string;
  mirror: boolean;
}) {
  const dark = trainPaint(cfg.trainColor, cfg.accentColor, trainType).dark;
  const cars = buildCars(cfg, rankRiders(riders), level, trainType, mirror);
  return (
    <div
      style={{
        display: "flex",
        // Riding right puts the engine at the right-hand end, in front.
        flexDirection: mirror ? "row-reverse" : "row",
        alignItems: "flex-end",
        height: TRAIN_H,
      }}
    >
      {cars.map((car, i) => (
        <Fragment key={car.key}>
          {i > 0 ? <Coupler color={dark} /> : null}
          <div style={{ flex: "none" }}>{car.node}</div>
        </Fragment>
      ))}
    </div>
  );
}

interface TrainProps {
  cfg: HypeTrainWidgetItemConfig;
  riders: readonly HypeTrainRider[];
  level: number;
  trainType: string;
  /** False once the hype train has ended: finish up and drive off. */
  active: boolean;
  box: { w: number; h: number };
  scale: number;
  onGone: () => void;
}

/** Where a car turns, as a share of its height: about the middle of the body, above the wheels. */
const PIVOT_Y = 0.62;
/** How quickly a wagon slides to its new place when the ranking changes, per second. */
const SLIDE_RATE = 2.5;

/** Per car, what the loop remembers between frames. */
interface CarTrack {
  /** Where along the trail it is now, in px behind the nose. */
  at: number;
  /** Its place in the train last frame, to notice a reorder. */
  slot: number;
  /** Where the current move started and ends, for the overtaking hop. */
  moveFrom: number;
  moveTo: number;
  /** When it joined the train, for the join effect; null for the cars that rolled in with it. */
  joinedAt: number | null;
}

/**
 * The train on screen for the whole hype train. Bounce: the engine roams the
 * widget DVD-style and the wagons follow its trail. Across: it crosses from
 * side to side along the bottom, again and again. Either way, after the end it
 * drives off the next edge it reaches.
 *
 * The wagons are ranked by support. When the ranking changes they slide to
 * their new places, the one moving up hopping over the others; a new rider's
 * wagon arrives with the chosen join effect. Runs on requestAnimationFrame and
 * writes transforms straight to the cars, so a moving train costs React nothing.
 */
function LiveTrain({ cfg, riders, level, trainType, active, box, scale, onGone }: TrainProps) {
  const cars = buildCars(cfg, rankRiders(riders), level, trainType, false);
  const carEls = useRef(new Map<string, HTMLDivElement>());
  // The loop reads the latest of everything without restarting.
  const live = useRef({ cars, cfg, active, box, scale, speed: hypeTrainSpeed(cfg, level), onGone });
  live.current = { cars, cfg, active, box, scale, speed: hypeTrainSpeed(cfg, level), onGone };

  useLayoutEffect(() => {
    let motion: BounceMotion | null = null;
    let gone = false;
    let raf = 0;
    let last = performance.now();
    // Eases towards the level's speed rather than jumping to it.
    let speed = live.current.speed;
    // Across restarts a crossing once the train has been on screen and left it.
    let seenOnScreen = false;
    const tracks = new Map<string, CarTrack>();

    const bounds = (): BounceBox => {
      const { box: b, scale: s } = live.current;
      return {
        w: b.w,
        h: b.h,
        // Half the train's height from every edge, so the engine stays on screen while it turns.
        padX: TRAIN_H * s * 0.45,
        padY: TRAIN_H * s * 0.45,
        // About a wagon and a half: tight enough to turn round near the edge, wide enough that nothing folds.
        turnRadius: WAGON_W * s * 1.4,
      };
    };

    /** Each car's own spot: loco at the nose, the rest coupled on behind, in ranking order. */
    const slots = () => {
      const { cars: cs, scale: s } = live.current;
      const out: number[] = [];
      let at = 0;
      for (const car of cs) {
        out.push(at);
        at += (car.width + COUPLER_W) * s;
      }
      return { slots: out, trainLength: at };
    };

    const startMotion = (trainLength: number) => {
      const { cfg: c, box: b, scale: s } = live.current;
      const bx = bounds();
      if (c.movement === "across") {
        // Wheels on the bottom edge.
        const y = b.h - TRAIN_H * s * (1 - PIVOT_Y) - 2;
        return createAcrossMotion(bx, trainLength, c.direction === "ltr", y);
      }
      return createBounceMotion(bx, trainLength);
    };

    const init = slots();
    live.current.cars.forEach((car, i) => {
      const at = init.slots[i]!;
      tracks.set(car.key, { at, slot: i, moveFrom: at, moveTo: at, joinedAt: null });
    });
    motion = startMotion(init.trainLength);

    const frame = (now: number) => {
      // A dropped frame or a hidden tab shouldn't teleport the train.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { cars: cs, cfg: c, box: b, scale: s, active: running, speed: target } = live.current;
      speed += (target - speed) * Math.min(1, dt * 1.5);
      const { slots: spots, trainLength } = slots();

      // Slide every car towards its spot; note reorders and newcomers.
      let keep = trainLength;
      const poses = cs.map((car, i) => {
        const spot = spots[i]!;
        let t = tracks.get(car.key);
        if (!t) {
          t = { at: spot, slot: i, moveFrom: spot, moveTo: spot, joinedAt: now };
          tracks.set(car.key, t);
        }
        if (t.moveTo !== spot) {
          t.moveFrom = t.at;
          t.moveTo = spot;
        }
        t.slot = i;
        t.at += (spot - t.at) * Math.min(1, dt * SLIDE_RATE);
        if (Math.abs(spot - t.at) < 0.5) t.at = spot;

        const join = t.joinedAt === null ? null : joinPose(c.joinEffect, (now - t.joinedAt) / (JOIN_EFFECT_MS[c.joinEffect] || 1));
        if (join && join.opacity === 1 && join.scale === 1 && join.lift === 0 && join.behind === 0) t.joinedAt = null;
        const travel = (t.moveFrom - t.moveTo) / s;
        const progress = t.moveFrom === t.moveTo ? 1 : (t.moveFrom - t.at) / (t.moveFrom - t.moveTo);
        const hop = overtakeLift(travel, progress);
        const front = t.at + (join?.behind ?? 0) * s;
        keep = Math.max(keep, front + car.width * s);
        return { car, front, lift: (join?.lift ?? 0) + hop, opacity: join?.opacity ?? 1, grow: join?.scale ?? 1, top: join ? 3 : hop > 0 ? 2 : 1 };
      });
      for (const key of tracks.keys()) if (!cs.some((car) => car.key === key)) tracks.delete(key);

      const bx = bounds();
      motion = stepBounceMotion(motion!, speed * dt, bx, running && c.movement === "bounce", keep + 10);
      const distances: number[] = [];
      for (const p of poses) distances.push(p.front, p.front + p.car.width * s);
      const points = pointsAlongTrail(motion.trail, distances);
      const margin = LOCO_W * s;
      let allOff = true;
      poses.forEach((pose, i) => {
        const el = carEls.current.get(pose.car.key);
        const front = points[i * 2];
        const back = points[i * 2 + 1];
        if (!el || !front || !back) return;
        const p = placeCar(front, back);
        if (!offBox(p, b, margin)) allOff = false;
        el.style.transform =
          `translate(${p.x - pose.car.width / 2}px, ${p.y - TRAIN_H * PIVOT_Y}px) rotate(${p.angle}rad) ` +
          `translateY(${-pose.lift * s}px) scale(${s * pose.grow})`;
        el.style.opacity = String(pose.opacity);
        el.style.zIndex = String(pose.top);
        el.style.setProperty("--sw-ht-flip", p.mirrored ? "scaleX(-1)" : "none");
        el.style.setProperty("--sw-ht-m", p.mirrored ? "1" : "0");
      });
      if (!allOff) seenOnScreen = true;

      if (allOff && seenOnScreen) {
        if (!running) {
          gone = true;
          live.current.onGone();
          return;
        }
        // Across: this crossing is done, the next one sets off.
        if (c.movement === "across") {
          seenOnScreen = false;
          motion = startMotion(trainLength);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      if (!gone) cancelAnimationFrame(raf);
    };
  }, []);

  // A stalled browser source must not keep an ended train on screen forever.
  useEffect(() => {
    if (active) return;
    const { box: b, scale: s, speed: sp } = live.current;
    const trainLength = trainDesignWidth(cars.length, false) * s;
    const t = setTimeout(() => live.current.onGone(), ((b.w + b.h + trainLength) * 2 * 1000) / sp + 5000);
    return () => clearTimeout(t);
    // Only when the train ends.
  }, [active]);

  return (
    <>
      {cars.map((car) => (
        <div
          key={car.key}
          ref={(el) => {
            if (el) carEls.current.set(car.key, el);
            else carEls.current.delete(car.key);
          }}
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: car.width,
            height: TRAIN_H,
            transformOrigin: `50% ${PIVOT_Y * 100}%`,
            // Off screen until the loop places it; the loop owns transform, opacity and stacking after that.
            transform: "translate(-99999px, 0)",
            willChange: "transform",
          }}
        >
          {car.node}
        </div>
      ))}
    </>
  );
}

export function HypeTrainWidgetRenderer({ item, scene, isEditor = false }: HypeTrainWidgetRendererProps) {
  const cfg = useMemo(() => normalizeHypeTrainWidgetConfig(item.config), [item.config]);
  useGoogleFonts(useMemo(() => [cfg.fontFamily], [cfg.fontFamily]));

  const rootRef = useRef<HTMLDivElement | null>(null);
  const box = useBoxSize(rootRef);
  // The train's own size, capped by the widget's height so a thin lane still fits it.
  const scale = box.h > 0 ? Math.min(cfg.trainSize, box.h) / TRAIN_H : 0;
  const bounce = cfg.movement === "bounce";

  const [state, setState] = useState<HypeTrainState>(EMPTY_HYPE_TRAIN_STATE);

  const onFrame = useCallback((frame: HypeTrainFrame) => {
    if (!frame?.type) return;
    setState((s) => applyHypeTrainFrame(s, frame, Date.now()));
  }, []);

  const token = scene?.subscriber_token;

  // Real events and Live tests over the scene's WS room.
  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? "";
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => onFrame(raw as HypeTrainFrame));
  }, [token, onFrame]);

  // Editor: Local test fires arrive as a browser event.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onTest = (e: Event) => {
      const detail = (e as CustomEvent<AlertTestBrowserEventDetail>).detail;
      if (!detail || (scene && detail.sceneId !== scene.id)) return;
      onFrame(detail.message as HypeTrainFrame);
    };
    window.addEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
    return () => window.removeEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
  }, [scene, onFrame]);

  // Editor: Preview runs a short sample train, with riders joining on the way.
  useEffect(() => {
    if (!isEditor || typeof window === "undefined") return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const onPreview = (e: Event) => {
      const detail = (e as CustomEvent<HypeTrainPreviewDetail>).detail;
      if (!detail || detail.itemId !== item.id) return;
      for (const t of timers.splice(0)) clearTimeout(t);
      const train = { id: `preview-${Date.now()}`, type: "regular", top_contributions: PREVIEW_START };
      onFrame({ type: "channel.hype_train.begin", payload: { ...train, level: 1 } });
      for (const j of PREVIEW_JOINERS) {
        const login = j.name.toLowerCase();
        timers.push(
          setTimeout(
            () =>
              onFrame({
                type: "channel.cheer",
                payload: { user_id: `sample-${login}`, user_login: login, user_name: j.name, bits: j.bits },
              }),
            j.at,
          ),
        );
      }
      timers.push(setTimeout(() => onFrame({ type: "channel.hype_train.progress", payload: { ...train, level: 2 } }), 7000));
      timers.push(setTimeout(() => onFrame({ type: "channel.hype_train.end", payload: { ...train, level: 2 } }), PREVIEW_MS));
    };
    window.addEventListener(HYPE_TRAIN_PREVIEW_EVENT, onPreview);
    return () => {
      window.removeEventListener(HYPE_TRAIN_PREVIEW_EVENT, onPreview);
      for (const t of timers) clearTimeout(t);
    };
  }, [isEditor, item.id, onFrame]);

  // Clears a train whose end event never came, a little after Twitch says it ran out.
  useEffect(() => {
    if (!state.active || state.expiresAt === null) return;
    const wait = Math.max(0, state.expiresAt + HYPE_TRAIN_EXPIRY_GRACE_MS - Date.now()) + 50;
    const t = setTimeout(() => setState((s) => expireHypeTrain(s, Date.now())), wait);
    return () => clearTimeout(t);
  }, [state.active, state.expiresAt]);

  const rideKey = state.rideKey;
  const onGone = useCallback(() => setState((s) => hypeTrainGone(s, rideKey)), [rideKey]);

  // Avatars for riders the event didn't bring one for.
  const triedRef = useRef(new Set<string>());
  const missing = useMemo(() => {
    const ids = new Set<string>();
    for (const r of state.riders) {
      if (!r.avatar && FETCHABLE_ID.test(r.id) && !triedRef.current.has(r.id)) ids.add(r.id);
    }
    return [...ids].sort().join(",");
  }, [state.riders]);
  useEffect(() => {
    if (!cfg.showAvatars || !missing) return;
    if (!isEditor && !token) return;
    const ids = missing.split(",").slice(0, 100);
    let cancelled = false;
    const t = setTimeout(async () => {
      for (const id of ids) triedRef.current.add(id);
      const url = `${isEditor ? "/api/twitch/assets/users" : "/api/twitch/users"}?ids=${ids.join(",")}`;
      try {
        const res = await fetch(url, isEditor ? undefined : { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { users?: Record<string, { profile_image_url?: string }> };
        const avatars: Record<string, string> = {};
        for (const [id, u] of Object.entries(body.users ?? {})) if (u?.profile_image_url) avatars[id] = u.profile_image_url;
        if (!cancelled) setState((s) => applyAvatars(s, avatars));
      } catch {
        // Initials stand in; the next new rider tries again for their own id.
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [missing, cfg.showAvatars, isEditor, token]);

  // Wheels turn as fast as the train moves.
  const spin = scale > 0 ? (2 * Math.PI * SPIN_RADIUS * scale) / hypeTrainSpeed(cfg, state.showing ? state.level : 1) : 0.6;
  const showing = state.showing && scale > 0;
  const parked = isEditor && !state.showing;

  return (
    <div
      ref={rootRef}
      className="sw-ht"
      data-parked={parked ? "true" : undefined}
      style={
        {
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          fontFamily: `"${cfg.fontFamily}", sans-serif`,
          "--sw-ht-spin": `${spin.toFixed(3)}s`,
        } as CSSProperties
      }
    >
      <style>{HYPE_TRAIN_KEYFRAMES}</style>
      {showing ? (
        <LiveTrain
          // Switching movement mid-train starts the train over in the new style.
          key={`${rideKey}-${cfg.movement}`}
          cfg={cfg}
          riders={state.riders}
          level={state.level}
          trainType={state.trainType}
          active={state.active}
          box={box}
          scale={scale}
          onGone={onGone}
        />
      ) : parked && scale > 0 ? (
        <div
          style={{
            position: "absolute",
            left: "50%",
            // Bouncing trains can be anywhere, so the sample parks in the middle.
            bottom: bounce ? `calc(50% - ${(TRAIN_H * scale) / 2}px)` : 0,
            transformOrigin: "0 100%",
            transform: `translateX(${(-trainDesignWidth(PARKED_RIDERS.length, false) * scale) / 2}px) scale(${scale})`,
            opacity: 0.6,
          }}
        >
          <TrainRow
            cfg={cfg}
            riders={PARKED_RIDERS}
            level={3}
            trainType="regular"
            mirror={bounce || cfg.direction === "ltr"}
          />
        </div>
      ) : null}
    </div>
  );
}
