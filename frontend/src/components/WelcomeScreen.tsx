"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Shield, Map, BookOpen, ArrowRight, Loader2, Play, Monitor, Images, X, ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";

const SCREENSHOTS = [
  { src: "/screenshots/01-main-map-layers.png", label: "Mapa z warstwami danych" },
  { src: "/screenshots/02-h3-heatmap-analytics.png", label: "Analityka heksagonalna H3" },
  { src: "/screenshots/03-scenario-toxic-cloud.png", label: "Scenariusz chmury toksycznej" },
  { src: "/screenshots/04-scenario-flood-isok.png", label: "Scenariusz powodzi ISOK" },
  { src: "/screenshots/05-scenario-civil-reports.png", label: "Zgłoszenia cywilne CIVIL42" },
  { src: "/screenshots/06-civil42-mobile-simulator.png", label: "Symulator aplikacji mobilnej" },
  { src: "/screenshots/07-civil-report-details.png", label: "Szczegóły zgłoszenia cywilnego" },
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
                <a
                  href="https://github.com/pablo-mano/sztab-kryzysowy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full rounded-lg border border-border bg-card hover:bg-accent/50 text-muted-foreground font-medium px-6 py-3 transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                  GitHub
                </a>
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
