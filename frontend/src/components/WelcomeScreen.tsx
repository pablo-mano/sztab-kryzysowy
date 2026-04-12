"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Shield, Map, BookOpen, ArrowRight, Loader2, Play, Monitor, Images, X, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";

const SCREENSHOTS = [
  { src: "/screenshots/toxic-cloud.png", label: "Symulacja chmury toksycznej" },
  { src: "/screenshots/flood.png", label: "Scenariusz powodzi ISOK" },
  { src: "/screenshots/civil-reports.png", label: "Zgłoszenia cywilne CIVIL42" },
  { src: "/screenshots/impact-bar.png", label: "Analiza wpływu na infrastrukturę" },
  { src: "/screenshots/map-layers.png", label: "Warstwy danych na mapie" },
];

interface WelcomeScreenProps {
  onContinue: () => void;
  onGuide: () => void;
}

export function WelcomeScreen({ onContinue, onGuide }: WelcomeScreenProps) {
  const [ready, setReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  // Simulate minimum loading time so the screen doesn't flash
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => {
    setFadeOut(true);
    setTimeout(onContinue, 400);
  };

  return (
    <div
      className={`fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto bg-background transition-opacity duration-400 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      <div className="relative flex flex-col items-center text-center px-6 max-w-xl py-10 my-auto">
        {/* Icon */}
        <div className="relative mb-6">
          <div className="absolute inset-0 rounded-full bg-rose-500/20 blur-2xl scale-150" />
          <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/30">
            <Shield className="w-10 h-10 text-rose-400" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2">
          Sztab Kryzysowy
        </h1>
        <div className="flex items-center gap-2 mb-5">
          <Map className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground font-medium">
            Woj. Lubelskie
          </span>
        </div>

        {isMobile ? (
          <>
            {/* Mobile-specific content */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 mb-8 max-w-md">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Monitor className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-300">
                  Wersja desktopowa
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Aplikacja jest zoptymalizowana pod ekrany komputerów i&nbsp;laptopów.
                Wersja mobilna jest w planie rozwoju — do tego czasu
                zalecamy korzystanie z&nbsp;urządzenia z&nbsp;większym ekranem.
              </p>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-md">
              Obejrzyj film demonstracyjny, aby poznać możliwości systemu
              zarządzania kryzysowego dla Województwa Lubelskiego.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {[
                "Chmura toksyczna",
                "Powódź ISOK",
                "Zgłoszenia cywilne",
                "16 warstw danych",
                "Analiza wpływu",
              ].map((f) => (
                <span
                  key={f}
                  className="text-[11px] font-medium px-3 py-1 rounded-full border border-border bg-card text-muted-foreground"
                >
                  {f}
                </span>
              ))}
            </div>

            <div className="flex flex-col gap-3 w-full max-w-xs">
              <a
                href="https://youtu.be/kziOB1m4A4I"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold px-6 py-3 transition-colors shadow-lg shadow-rose-500/20"
              >
                <Play className="w-4 h-4" />
                Obejrzyj film demonstracyjny
              </a>
              <button
                onClick={() => { setGalleryIndex(0); setGalleryOpen(true); }}
                className="flex items-center justify-center gap-2 w-full rounded-lg border border-border bg-card hover:bg-accent/50 text-muted-foreground font-medium px-6 py-3 transition-colors"
              >
                <Images className="w-4 h-4" />
                Galeria zrzutów ekranu
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Desktop content */}
            <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-md">
              Inteligentna mapa decyzyjna dla zarządzania kryzysowego.
              Integracja danych w czasie rzeczywistym z GIOŚ, IMGW, ISOK i CIVIL42
              z symulacją scenariuszy zagrożeń i automatyczną oceną wpływu na infrastrukturę krytyczną.
            </p>

            {/* Feature pills */}
            <div className="flex flex-wrap justify-center gap-2 mb-10">
              {[
                "Chmura toksyczna",
                "Powódź ISOK",
                "Zgłoszenia cywilne",
                "16 warstw danych",
                "Analiza wpływu",
              ].map((f) => (
                <span
                  key={f}
                  className="text-[11px] font-medium px-3 py-1 rounded-full border border-border bg-card text-muted-foreground"
                >
                  {f}
                </span>
              ))}
            </div>

            {/* Buttons */}
            {ready ? (
              <div className="flex flex-col gap-3 w-full max-w-xs animate-in fade-in duration-300">
                <button
                  onClick={onGuide}
                  className="flex items-center justify-center gap-2 w-full rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold px-6 py-3 transition-colors shadow-lg shadow-rose-500/20"
                >
                  <BookOpen className="w-4 h-4" />
                  Przewodnik po aplikacji
                </button>
                <a
                  href="https://youtu.be/kziOB1m4A4I"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-medium px-6 py-3 transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Obejrzyj film demonstracyjny
                </a>
                <button
                  onClick={handleContinue}
                  className="flex items-center justify-center gap-2 w-full rounded-lg border border-border bg-card hover:bg-accent/50 text-muted-foreground font-medium px-6 py-3 transition-colors"
                >
                  Przejdź bezpośrednio do aplikacji
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 animate-pulse">
                <Loader2 className="w-6 h-6 text-rose-400 animate-spin" />
                <span className="text-xs text-muted-foreground">Ładowanie danych...</span>
              </div>
            )}
          </>
        )}

        {/* Attribution */}
        <div className="mt-10 space-y-2 text-xs text-muted-foreground">
          <p className="font-medium">
            Wykonano na zlecenie Marszałka Województwa Lubelskiego
          </p>
          <p>
            Zespół: Paweł Manowiecki, Krzysztof Rzymkowski, Radek Sosnowski, Michał Karpiński
          </p>
        </div>
      </div>

      {/* Screenshot gallery modal */}
      {galleryOpen && createPortal(
        <div
          className="fixed inset-0 z-[10001] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setGalleryOpen(false)}
        >
          {/* Close */}
          <button
            onClick={() => setGalleryOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Label */}
          <div className="text-sm text-white/80 font-medium mb-3 px-4 text-center">
            {SCREENSHOTS[galleryIndex].label}
          </div>

          {/* Image */}
          <div className="flex-1 flex items-center justify-center min-h-0 w-full px-12" onClick={(e) => e.stopPropagation()}>
            <img
              src={SCREENSHOTS[galleryIndex].src}
              alt={SCREENSHOTS[galleryIndex].label}
              className="max-w-full max-h-[70vh] rounded-lg shadow-2xl object-contain"
            />
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-4 py-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setGalleryIndex((i) => (i - 1 + SCREENSHOTS.length) % SCREENSHOTS.length)}
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs text-white/60 font-mono">
              {galleryIndex + 1} / {SCREENSHOTS.length}
            </span>
            <button
              onClick={() => setGalleryIndex((i) => (i + 1) % SCREENSHOTS.length)}
              className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
