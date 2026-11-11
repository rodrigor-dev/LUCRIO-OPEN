"use client";

import { useEffect, useRef } from "react";

/**
 * Por que existe: depois de pagar na Cakto, o webhook libera a assinatura
 * no servidor em ~1 segundo, mas a tela do sistema só consultava o status
 * uma vez, ao abrir. Quem voltava para a aba (ou pelo botão "voltar") via o
 * estado antigo e precisava fechar e abrir o sistema.
 *
 * Aqui o sistema:
 *  1. rechecar a assinatura sempre que o usuário volta para a aba/janela;
 *  2. enquanto o checkout foi aberto há pouco e a assinatura ainda não está
 *     ativa, rechecar a cada poucos segundos (até a Cakto confirmar).
 */

const CHAVE_CHECKOUT = "faturion:checkout-aberto-em";
const JANELA_CHECKOUT_MS = 30 * 60 * 1000; // 30 min
const INTERVALO_MS = 4000;

export function marcarCheckoutAberto(): void {
  try {
    localStorage.setItem(CHAVE_CHECKOUT, String(Date.now()));
  } catch {
    // localStorage pode estar bloqueado (aba anônima): só perde o polling.
  }
}

export function limparCheckoutAberto(): void {
  try {
    localStorage.removeItem(CHAVE_CHECKOUT);
  } catch {
    // ignorado
  }
}

export function checkoutAbertoRecentemente(): boolean {
  try {
    const valor = Number(localStorage.getItem(CHAVE_CHECKOUT));
    return valor > 0 && Date.now() - valor < JANELA_CHECKOUT_MS;
  } catch {
    return false;
  }
}

/**
 * @param recarregar    função que consulta a assinatura de novo (sem piscar a tela)
 * @param aguardandoAtivacao  true enquanto a assinatura ainda NÃO está ativa
 */
export function useRevalidarAssinatura(
  recarregar: () => void | Promise<void>,
  aguardandoAtivacao: boolean
): void {
  const recarregarRef = useRef(recarregar);
  recarregarRef.current = recarregar;

  // 1) Voltou para a aba / janela / página restaurada pelo botão "voltar"
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === "visible") {
        void recarregarRef.current();
      }
    };
    const aoRestaurarPagina = (e: PageTransitionEvent) => {
      if (e.persisted) void recarregarRef.current();
    };

    document.addEventListener("visibilitychange", aoVoltar);
    window.addEventListener("focus", aoVoltar);
    window.addEventListener("pageshow", aoRestaurarPagina);
    return () => {
      document.removeEventListener("visibilitychange", aoVoltar);
      window.removeEventListener("focus", aoVoltar);
      window.removeEventListener("pageshow", aoRestaurarPagina);
    };
  }, []);

  // 2) Acabou de abrir o checkout e a assinatura ainda não ativou
  useEffect(() => {
    if (!aguardandoAtivacao) {
      limparCheckoutAberto();
      return;
    }
    if (!checkoutAbertoRecentemente()) return;

    const timer = setInterval(() => {
      if (!checkoutAbertoRecentemente()) {
        clearInterval(timer);
        return;
      }
      if (document.visibilityState === "visible") {
        void recarregarRef.current();
      }
    }, INTERVALO_MS);

    return () => clearInterval(timer);
  }, [aguardandoAtivacao]);
}
