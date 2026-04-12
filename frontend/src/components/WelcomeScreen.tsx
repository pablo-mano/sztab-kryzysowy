"use client";

import { useState, useEffect } from "react";
import { Shield, Map, BookOpen, ArrowRight, Loader2 } from "lucide-react";

interface WelcomeScreenProps {
  onContinue: () => void;
  onGuide: () => void;
}

export function WelcomeScreen({ onContinue, onGuide }: WelcomeScreenProps) {
  const [ready, setReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

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
      className={`fixed inset-0 z-[10000] flex items-center justify-center bg-background transition-opacity duration-400 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      <div className="relative flex flex-col items-center text-center px-6 max-w-xl">
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

        {/* Description */}
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
    </div>
  );
}
