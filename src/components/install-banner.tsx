"use client";

import { useEffect, useState } from "react";

interface deferredPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<deferredPrompt | null>(
    null
  );
  const [mostrarBanner, setMostrarBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as deferredPrompt);

      const jaInstalado = window.matchMedia("(display-mode: standalone)").matches;
      if (!jaInstalado) {
        const bannerVisto = localStorage.getItem("lucrio_install_banner");
        if (!bannerVisto) {
          setMostrarBanner(true);
        }
      }
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstalar() {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === "accepted") {
      setMostrarBanner(false);
      localStorage.setItem("lucrio_install_banner", "dismissed");
    }

    setDeferredPrompt(null);
  }

  function handleFechar() {
    setMostrarBanner(false);
    localStorage.setItem("lucrio_install_banner", "dismissed");
  }

  if (!mostrarBanner || !deferredPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-4 sm:w-80">
      <div className="rounded-lg border bg-card p-4 shadow-lg">
        <div className="mb-3 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <span className="text-xl">📱</span>
            </div>
            <div>
              <p className="text-sm font-medium">Instalar LUCRIO</p>
              <p className="text-xs text-muted-foreground">
                Acesse offline pelo seu celular
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
