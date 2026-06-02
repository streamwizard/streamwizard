"use client";

import { useEffect, useRef, useState } from "react";
import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

const DOT_LIFETIME_MS = 650;
let globalDotId = 0;

type AnimatedEdgeData = {
  isLast?: boolean;
  dotColor?: string;
  trigger?: number;
};

type Dot = {
  id: number;
  isLast: boolean;
};

export function AnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: EdgeProps) {
  const { isLast = true, dotColor = "#60a5fa", trigger = 0 } = (data ?? {}) as AnimatedEdgeData;

  const [dots, setDots] = useState<Dot[]>([]);
  const lastTriggerRef = useRef(trigger);

  if (trigger !== lastTriggerRef.current && trigger > 0) {
    lastTriggerRef.current = trigger;
    const dotId = ++globalDotId;
    setDots((prev) => [...prev, { id: dotId, isLast }]);
  }

  useEffect(() => {
    if (dots.length === 0) return;
    const latest = dots[dots.length - 1]!;
    const timer = setTimeout(() => {
      setDots((prev) => prev.filter((d) => d.id !== latest.id));
    }, DOT_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [dots.length]);

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 16,
  });

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      {dots.map((dot) => (
        <g key={dot.id}>
          <circle r="4" fill={dotColor} opacity="0.7">
            <animateMotion dur="0.6s" repeatCount="1" path={edgePath} fill="freeze" />
            {dot.isLast && (
              <animate attributeName="opacity" values="0.7;0.7;0" keyTimes="0;0.7;1" dur="0.6s" fill="freeze" />
            )}
          </circle>
          <circle r="2" fill="white" opacity="0.9">
            <animateMotion dur="0.6s" repeatCount="1" path={edgePath} fill="freeze" />
            {dot.isLast && (
              <animate attributeName="opacity" values="0.9;0.9;0" keyTimes="0;0.7;1" dur="0.6s" fill="freeze" />
            )}
          </circle>
        </g>
      ))}
    </>
  );
}
