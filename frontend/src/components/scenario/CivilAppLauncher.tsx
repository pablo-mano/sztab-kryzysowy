"use client";

import { useState, useEffect, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Smartphone, X, QrCode } from "lucide-react";

const CIVIL42_URL = "https://civil42poc.web.app/";

export function CivilAppLauncher() {
  const [showSimulator, setShowSimulator] = useState(false);

  const close = useCallback(() => setShowSimulator(false), []);

  useEffect(() => {
    if (!showSimulator) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSimulator, close]);

  return (
    <>
      <div className="rounded-lg border border-border bg-card p-3 space-y-3">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Aplikacja mobilna CIVIL42
        </div>

        <div className="flex gap-3 items-start">
          {/* QR Code */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <div className="rounded-lg bg-white p-2">
              <QRCodeSVG value={CIVIL42_URL} size={100} level="M" />
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <QrCode className="w-3 h-3" />
              <span>Zeskanuj telefonem</span>
            </div>
          </div>

          {/* Separator */}
          <div className="flex flex-col items-center gap-1 self-stretch py-2">
            <div className="flex-1 w-px bg-border" />
            <span className="text-[10px] text-muted-foreground/60">lub</span>
            <div className="flex-1 w-px bg-border" />
          </div>

          {/* Phone simulator button */}
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <button
              onClick={() => setShowSimulator(true)}
              className="flex flex-col items-center gap-2 rounded-lg border border-border hover:border-rose-400/40 bg-card hover:bg-rose-500/5 p-3 transition-colors w-full"
            >
              <Smartphone className="w-8 h-8 text-rose-400" />
              <span className="text-xs font-medium text-rose-300">Podgląd</span>
            </button>
            <div className="text-[10px] text-muted-foreground text-center">
              Otwórz symulator telefonu
            </div>
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">
          Uruchom aplikację CIVIL42 na telefonie (QR) lub w symulatorze, aby wysyłać zgłoszenia na żywo.
        </p>
      </div>

      {/* iPhone simulator modal */}
      {showSimulator && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowSimulator(false)}
        >
          <div
            className="relative flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={close}
              className="absolute -top-4 -right-4 z-30 rounded-full bg-neutral-700 border border-neutral-500 p-2 text-neutral-200 hover:text-white hover:bg-neutral-600 transition-colors shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {/* iPhone frame */}
            <div className="relative rounded-[3rem] border-[14px] border-neutral-800 bg-neutral-800 shadow-2xl shadow-black/50"
              style={{ width: 375 + 28, height: 812 + 28, maxHeight: "85vh" }}
            >
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[30px] bg-neutral-800 rounded-b-2xl z-10" />

              {/* Dynamic Island camera dot */}
              <div className="absolute top-[8px] left-1/2 -translate-x-1/2 w-[12px] h-[12px] bg-neutral-950 rounded-full z-20" />

              {/* Screen */}
              <div className="w-full h-full rounded-[2.2rem] overflow-hidden bg-white">
                <iframe
                  src={CIVIL42_URL}
                  className="w-full h-full border-0"
                  title="CIVIL42 - Symulator aplikacji mobilnej"
                  allow="geolocation; camera; microphone"
                />
              </div>

              {/* Home indicator */}
              <div className="absolute bottom-[6px] left-1/2 -translate-x-1/2 w-[100px] h-[4px] bg-neutral-600 rounded-full" />
            </div>

            {/* Label */}
            <div className="mt-3 text-sm text-neutral-400 font-medium">
              CIVIL42 — Symulator aplikacji mobilnej
            </div>
          </div>
        </div>
      )}
    </>
  );
}
