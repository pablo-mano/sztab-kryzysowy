"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, X, BookOpen, Sparkles } from "lucide-react";
import type { TourState } from "./useTour";
import type { TourPlacement } from "./tour-steps";

interface TourOverlayProps {
  tour: TourState;
}

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getTooltipPosition(
  placement: TourPlacement,
  rect: TargetRect,
  tooltipW: number,
  tooltipH: number,
) {
  const pad = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;

  switch (placement) {
    case "right":
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left + rect.width + pad;
      break;
    case "left":
      top = rect.top + rect.height / 2 - tooltipH / 2;
      left = rect.left - tooltipW - pad;
      break;
    case "bottom":
      top = rect.top + rect.height + pad;
      left = rect.left + rect.width / 2 - tooltipW / 2;
      break;
    case "top":
      top = rect.top - tooltipH - pad;
      left = rect.left + rect.width / 2 - tooltipW / 2;
      break;
    default:
      return null;
  }

  // Clamp to viewport
  top = Math.max(pad, Math.min(top, vh - tooltipH - pad));
  left = Math.max(pad, Math.min(left, vw - tooltipW - pad));

  return { top, left };
}

export function TourOverlay({ tour }: TourOverlayProps) {
  const { active, currentStep, stepIndex, totalSteps, next, prev, skip } = tour;
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [fadeIn, setFadeIn] = useState(false);

  const measureTarget = useCallback(() => {
    if (!currentStep?.target) {
      setTargetRect(null);
      return;
    }
    let attempt = 0;
    const tryMeasure = () => {
      const el = document.querySelector(`[data-tour="${currentStep.target}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else if (attempt < 15) {
        attempt++;
        requestAnimationFrame(tryMeasure);
      } else {
        setTargetRect(null);
      }
    };
    tryMeasure();
  }, [currentStep]);

  // Re-measure on step change
  useEffect(() => {
    if (!active) return;
    measureTarget();
  }, [active, stepIndex, measureTarget]);

  // Re-measure on resize
  useEffect(() => {
    if (!active) return;
    const handler = () => measureTarget();
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, [active, measureTarget]);

  // Fade in
  useEffect(() => {
    if (active) {
      requestAnimationFrame(() => setFadeIn(true));
    } else {
      setFadeIn(false);
    }
  }, [active]);

  if (!active || !currentStep) return null;

  const isCenter = currentStep.placement === "center" || !targetRect;
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === totalSteps - 1;

  const tooltipW = 380;
  const tooltipH = 240;
  const tooltipPos = !isCenter && targetRect
    ? getTooltipPosition(currentStep.placement, targetRect, tooltipW, tooltipH)
    : null;

  return (
    <>
      {/* Highlight ring around target element — no blocking overlay */}
      {!isCenter && targetRect && (
        <div
          className={`fixed rounded-lg pointer-events-none z-[10001] transition-all duration-300 ${
            fadeIn ? "opacity-100" : "opacity-0"
          }`}
          style={{
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            border: "2px solid rgba(244,63,94,0.6)",
            boxShadow: "0 0 0 4px rgba(244,63,94,0.15), 0 0 20px rgba(244,63,94,0.1)",
          }}
        />
      )}

      {/* Tooltip — floating, non-blocking */}
      {isCenter ? (
        /* Centered card with subtle backdrop for intro/summary only */
        <div
          className={`fixed inset-0 z-[10002] flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
            fadeIn ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="absolute inset-0 bg-black/40 pointer-events-auto" onClick={skip} />
          <div
            className="pointer-events-auto relative rounded-xl border border-border bg-card p-6 shadow-2xl max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              {isLast ? (
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30">
                  <Sparkles className="w-5 h-5 text-emerald-400" />
                </div>
              ) : (
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30">
                  <BookOpen className="w-5 h-5 text-rose-400" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-semibold text-foreground">{currentStep.title}</h3>
                <span className="text-xs text-muted-foreground">
                  Krok {stepIndex + 1} z {totalSteps}
                </span>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              {currentStep.description}
            </p>
            <div className="flex items-center justify-between">
              <button
                onClick={skip}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Pomin przewodnik
              </button>
              <div className="flex items-center gap-2">
                {!isFirst && (
                  <button
                    onClick={prev}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-accent text-sm font-medium text-muted-foreground transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Wstecz
                  </button>
                )}
                <button
                  onClick={next}
                  className="flex items-center gap-1 px-4 py-1.5 rounded-md bg-rose-500 hover:bg-rose-400 text-white text-sm font-semibold transition-colors shadow-lg shadow-rose-500/20"
                >
                  {isLast ? "Zamknij" : "Dalej"}
                  {!isLast && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1 mt-4">
              {Array.from({ length: totalSteps }, (_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    i === stepIndex ? "bg-rose-400" : i < stepIndex ? "bg-rose-400/40" : "bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Positioned floating tooltip — app remains fully interactive */
        <div
          className={`fixed pointer-events-auto z-[10002] animate-in fade-in slide-in-from-bottom-2 duration-200 transition-opacity ${
            fadeIn ? "opacity-100" : "opacity-0"
          }`}
          style={{
            top: tooltipPos?.top ?? 0,
            left: tooltipPos?.left ?? 0,
            width: tooltipW,
          }}
        >
          <div className="rounded-xl border border-rose-500/30 bg-card p-5 shadow-2xl shadow-rose-500/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 rounded-md bg-rose-500/20 border border-rose-500/30">
                  <span className="text-xs font-bold text-rose-400">{stepIndex + 1}</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">{currentStep.title}</h3>
              </div>
              <button
                onClick={skip}
                className="p-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Zamknij przewodnik"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              {currentStep.description}
            </p>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground/60">
                {stepIndex + 1} / {totalSteps}
              </span>
              <div className="flex items-center gap-2">
                {!isFirst && (
                  <button
                    onClick={prev}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-card hover:bg-accent text-xs font-medium text-muted-foreground transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Wstecz
                  </button>
                )}
                <button
                  onClick={next}
                  className="flex items-center gap-1 px-3 py-1 rounded-md bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold transition-colors"
                >
                  {isLast ? "Zamknij" : "Dalej"}
                  {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-3 h-0.5 bg-muted-foreground/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500/60 rounded-full transition-all duration-300"
                style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
