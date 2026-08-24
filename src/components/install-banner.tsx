"use client";

import { useEffect, useState } from "react";

interface deferredPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<deferredPrompt | null>(
    null
  );
  const [mostrarBanner, setMostrarBanner] = useState(false);
  const [mostrarIOS, setMostrarIOS] = useState(false);

  useEffect(() => {
    const jaInstalado = window.matchMedia("(display-mode: standalone)").matches;
    if (jaInstalado) return;

    const bannerVisto = localStorage.getItem("faturion_install_banner");
    if (bannerVisto) return;

    if (isIOS()) {
      setMostrarIOS(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as deferredPrompt);
      (window as unknown as Record<string, unknown>).deferredInstallPrompt = e;
      setMostrarBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function handleFechar() {
    setMostrarBanner(false);
    setMostrarIOS(false);
    localStorage.setItem("faturion_install_banner", "dismissed");
  }

  async function handleInstalar() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setMostrarBanner(false);
      localStorage.setItem("faturion_install_banner", "dismissed");
    }

    setDeferredPrompt(null);
  }

  if (mostrarIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-50 lg:bottom-4 lg:left-auto lg:right-4 lg:w-80">
        <div className="rounded-lg border bg-card p-4 shadow-lg">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <span className="text-xl">📱</span>
              </div>
              <div>
                <p className="text-sm font-medium">Instalar na tela principal</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Toque no botão <strong>compartilhar</strong> ☝️ e depois em{" "}
                  <strong>&quot;Adicionar à Tela de Início&quot;</strong>
                </p>
              </div>
            </div>
            <button
              onClick={handleFechar}
              aria-label="Fechar"
              className="text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
          <button
            onClick={handleFechar}
            className="w-full rounded-md border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            Entendi
          </button>
        </div>
      </div>
    );
  }

  if (!mostrarBanner || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 lg:bottom-4 lg:left-auto lg:right-4 lg:w-80">
      <div className="rounded-lg border bg-card p-4 shadow-lg">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <span className="text-xl">📱</span>
            </div>
            <div>
              <p className="text-sm font-medium">Instalar na tela principal</p>
              <p className="text-xs text-muted-foreground">
                Acesse pelo seu celular como um app
              </p>
            </div>
          </div>
          <button
            onClick={handleFechar}
            aria-label="Fechar banner de instalação"
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleInstalar}
            className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Instalar
          </button>
          <button
            onClick={handleFechar}
            className="rounded-md border px-3 py-2 text-xs font-medium transition-colors hover:bg-accent"
          >
            Agora não
          </button>
        </div>
      </div>
    </div>
  );
}
