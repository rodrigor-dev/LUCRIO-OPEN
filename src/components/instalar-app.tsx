"use client";

import { useEffect, useState } from "react";
import { Smartphone, Share, PlusSquare, MoreVertical, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EVENTO_INSTALACAO,
  appJaInstalado,
  ehCelular,
  ehIOS,
  limparAvisoInstalacao,
  marcarAppInstalado,
  obterAvisoInstalacao,
} from "@/lib/pwa-install";

/**
 * Cartão "Adicionar à tela inicial" das Configurações.
 * Só aparece para quem ainda não instalou o app neste aparelho.
 * - Android/Chrome: um toque abre a instalação do próprio navegador.
 * - iPhone/iPad: a Apple não permite instalar por botão, então mostramos
 *   o passo a passo (Compartilhar → Adicionar à Tela de Início).
 */
export default function InstalarApp() {
  const [visivel, setVisivel] = useState(false);
  const [podeInstalarDireto, setPodeInstalarDireto] = useState(false);
  const [instalando, setInstalando] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    function atualizar() {
      if (appJaInstalado()) {
        setVisivel(false);
        return;
      }
      const aviso = obterAvisoInstalacao();
      setPodeInstalarDireto(!!aviso);
      setIos(ehIOS());
      // No computador só mostra se o navegador oferecer a instalação.
      setVisivel(!!aviso || ehCelular());
    }

    atualizar();
    window.addEventListener(EVENTO_INSTALACAO, atualizar);
    return () => window.removeEventListener(EVENTO_INSTALACAO, atualizar);
  }, []);

  async function instalar() {
    const aviso = obterAvisoInstalacao();
    if (!aviso) {
      setAjudaAberta(true);
      return;
    }
    setInstalando(true);
    try {
      await aviso.prompt();
      const { outcome } = await aviso.userChoice;
      // O navegador só deixa usar o aviso uma vez.
      limparAvisoInstalacao();
      setPodeInstalarDireto(false);
      if (outcome === "accepted") {
        marcarAppInstalado();
        setVisivel(false);
        toast.success("Pronto! O FATURION foi adicionado à sua tela inicial.");
      }
    } catch {
      setAjudaAberta(true);
    } finally {
      setInstalando(false);
    }
  }

  if (!visivel) return null;

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/15">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold">Adicione o FATURION à tela inicial</p>
            <p className="text-xs text-muted-foreground">
              Abra direto pelo ícone, como um aplicativo, sem precisar do navegador.
            </p>
          </div>
        </div>
        <Button onClick={instalar} disabled={instalando} className="h-11 w-full sm:w-auto">
          {instalando ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlusSquare className="mr-2 h-4 w-4" />
          )}
          Adicionar à tela inicial
        </Button>
      </div>

      <Dialog open={ajudaAberta} onOpenChange={setAjudaAberta}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar à tela inicial</DialogTitle>
            <DialogDescription>
              {ios
                ? "No iPhone a Apple pede que seja feito pelo Safari. Leva 10 segundos:"
                : podeInstalarDireto
                ? "Siga os passos abaixo:"
                : "Faça pelo menu do navegador. Leva 10 segundos:"}
            </DialogDescription>
          </DialogHeader>

          {ios ? (
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                <span>
                  Abra o FATURION no <strong>Safari</strong> e toque em{" "}
                  <Share className="inline h-4 w-4 align-text-bottom" /> <strong>Compartilhar</strong> (na barra de baixo).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                <span>
                  Role e toque em <PlusSquare className="inline h-4 w-4 align-text-bottom" />{" "}
                  <strong>Adicionar à Tela de Início</strong>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                <span>Toque em <strong>Adicionar</strong>. O ícone do FATURION aparece na sua tela.</span>
              </li>
            </ol>
          ) : (
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">1</span>
                <span>
                  Toque no menu do navegador <MoreVertical className="inline h-4 w-4 align-text-bottom" /> (três pontinhos, no canto de cima).
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">2</span>
                <span>
                  Toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">3</span>
                <span>Confirme em <strong>Instalar</strong>.</span>
              </li>
            </ol>
          )}

          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button
              variant="ghost"
              className="h-11"
              onClick={() => {
                marcarAppInstalado();
                setVisivel(false);
                setAjudaAberta(false);
              }}
            >
              <X className="mr-2 h-4 w-4" />
              Já adicionei
            </Button>
            <Button className="h-11" onClick={() => setAjudaAberta(false)}>
              Entendi
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
