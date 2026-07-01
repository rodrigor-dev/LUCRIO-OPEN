const requisicoes = new Map<string, { count: number; resetEm: number }>();

export function verificarRateLimit(
  chave: string,
  limite: number,
  janelaMs: number
): { permitido: boolean; restante: number; resetEm: number } {
  const agora = Date.now();
  const registro = requisicoes.get(chave);

  if (!registro || agora > registro.resetEm) {
    requisicoes.set(chave, { count: 1, resetEm: agora + janelaMs });
    return { permitido: true, restante: limite - 1, resetEm: agora + janelaMs };
  }

  if (registro.count >= limite) {
    return { permitido: false, restante: 0, resetEm: registro.resetEm };
  }

  registro.count++;
  return { permitido: true, restante: limite - registro.count, resetEm: registro.resetEm };
}

export function obterChaveRateLimit(request: Request, prefixo: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${prefixo}:${ip}`;
}
