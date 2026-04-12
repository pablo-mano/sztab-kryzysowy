import { useState, useCallback, useEffect, useRef } from "react";
import type { TourStep, TourContext } from "./tour-steps";

export interface TourState {
  active: boolean;
  stepIndex: number;
  currentStep: TourStep | null;
  totalSteps: number;
  start: () => void;
  next: () => void;
  prev: () => void;
  skip: () => void;
}

export function useTour(steps: TourStep[], context: TourContext): TourState {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const ctxRef = useRef(context);
  ctxRef.current = context;

  const currentStep = active ? steps[stepIndex] ?? null : null;

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
    steps[0]?.onEnter?.(ctxRef.current);
  }, [steps]);

  const next = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      steps[stepIndex]?.onExit?.(ctxRef.current);
      setActive(false);
      return;
    }
    steps[stepIndex]?.onExit?.(ctxRef.current);
    const nextIdx = stepIndex + 1;
    setStepIndex(nextIdx);
    steps[nextIdx]?.onEnter?.(ctxRef.current);
  }, [stepIndex, steps]);

  const prev = useCallback(() => {
    if (stepIndex <= 0) return;
    steps[stepIndex]?.onExit?.(ctxRef.current);
    const prevIdx = stepIndex - 1;
    setStepIndex(prevIdx);
    steps[prevIdx]?.onEnter?.(ctxRef.current);
  }, [stepIndex, steps]);

  const skip = useCallback(() => {
    steps[stepIndex]?.onExit?.(ctxRef.current);
    ctxRef.current.deactivateScenario();
    setActive(false);
  }, [stepIndex, steps]);

  // ESC key to close
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") skip();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, skip]);

  return {
    active,
    stepIndex,
    currentStep,
    totalSteps: steps.length,
    start,
    next,
    prev,
    skip,
  };
}
