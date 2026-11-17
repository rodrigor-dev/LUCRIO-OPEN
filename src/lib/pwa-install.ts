/**
 * Instalação do app na tela inicial (PWA).
 *
 * O navegador avisa uma única vez que o app pode ser instalado (evento
 * `beforeinstallprompt`), muitas vezes antes da página terminar de carregar.
 * Um script no layout raiz guarda esse aviso em `window.deferredInstallPrompt`
 * e dispara o evento `faturion-instalacao` para os componentes saberem.
 */

export interface AvisoInstalacao extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export const EVENTO_INSTALACAO = "faturion-instalacao";
const CHAVE_INSTALADO = "faturion_app_instalado";

type JanelaComAviso = Window & { deferredInstallPrompt?: AvisoInstalacao | null };

export function obterAvisoInstalacao(): AvisoInstalacao | null {
  if (typeof window === "undefined") return null;
  return (window as JanelaComAviso).deferredInstallPrompt ?? null;
}

export function limparAvisoInstalacao() {
  if (typeof window === "undefined") return;
  (window as JanelaComAviso).deferredInstallPrompt = null;
}

export function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function ehCelular(): boolean {
  if (typeof navigator === "undefined") return false;
  return ehIOS() || /Android|Mobile/i.test(navigator.userAgent);
}

/** Está aberto como app (pela tela inicial)? */
export function abertoComoApp(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Já instalou neste aparelho (aberto como app agora ou registrado antes)? */
export function appJaInstalado(): boolean {
  if (abertoComoApp()) {
    marcarAppInstalado();
    return true;
  }
  try {
    return localStorage.getItem(CHAVE_INSTALADO) === "1";
  } catch {
    return false;
  }
}

export function marcarAppInstalado() {
  try {
    localStorage.setItem(CHAVE_INSTALADO, "1");
  } catch {
    /* sem armazenamento: ignora */
  }
}

/**
 * Script que roda antes da página carregar para não perder o aviso do
 * navegador. Fica como texto para ser colocado no layout raiz.
 */
export const SCRIPT_CAPTURA_INSTALACAO = `
(function(){
  try {
    window.addEventListener('beforeinstallprompt', function(e){
      e.preventDefault();
      window.deferredInstallPrompt = e;
      window.dispatchEvent(new Event('${EVENTO_INSTALACAO}'));
    });
    window.addEventListener('appinstalled', function(){
      window.deferredInstallPrompt = null;
      try { localStorage.setItem('${CHAVE_INSTALADO}', '1'); } catch (_) {}
      window.dispatchEvent(new Event('${EVENTO_INSTALACAO}'));
    });
  } catch (_) {}
})();
`;
