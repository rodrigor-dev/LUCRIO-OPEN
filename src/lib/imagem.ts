/**
 * Ajuste de imagens no navegador antes de enviar (logo da empresa).
 * Fotos de celular costumam ter 3–8 MB; reduzimos para no máximo 800 px,
 * o que deixa a logo nítida no orçamento e bem abaixo do limite de 2 MB.
 */

const LIMITE_ARMAZENAMENTO = 2 * 1024 * 1024;

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível ler a imagem"));
    img.src = src;
  });
}

function canvasParaBlob(canvas: HTMLCanvasElement, tipo: string, qualidade?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), tipo, qualidade));
}

const EXTENSAO: Record<string, string> = {
  "image/webp": "webp",
  "image/png": "png",
  "image/jpeg": "jpg",
};

/**
 * Reduz a imagem e devolve o arquivo pronto para enviar.
 * Mantém fundo transparente (WebP/PNG); se ainda ficar grande, usa JPEG.
 */
export async function prepararLogo(arquivo: File, ladoMaximo = 800): Promise<{ blob: Blob; extensao: string; tipo: string }> {
  const url = URL.createObjectURL(arquivo);
  try {
    let img: HTMLImageElement;
    try {
      img = await carregarImagem(url);
    } catch {
      throw new Error("Formato de imagem não suportado. Use uma foto em JPG ou PNG.");
    }

    const escala = Math.min(1, ladoMaximo / Math.max(img.naturalWidth, img.naturalHeight));
    const largura = Math.max(1, Math.round(img.naturalWidth * escala));
    const altura = Math.max(1, Math.round(img.naturalHeight * escala));

    const canvas = document.createElement("canvas");
    canvas.width = largura;
    canvas.height = altura;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível processar a imagem");
    ctx.drawImage(img, 0, 0, largura, altura);

    // Alguns navegadores (Safari) não geram WebP e devolvem PNG — tudo bem.
    let blob = await canvasParaBlob(canvas, "image/webp", 0.9);
    if (!blob || !EXTENSAO[blob.type] || blob.size > LIMITE_ARMAZENAMENTO) {
      const fundo = document.createElement("canvas");
      fundo.width = largura;
      fundo.height = altura;
      const c2 = fundo.getContext("2d")!;
      c2.fillStyle = "#ffffff";
      c2.fillRect(0, 0, largura, altura);
      c2.drawImage(canvas, 0, 0);
      blob = await canvasParaBlob(fundo, "image/jpeg", 0.88);
    }
    if (!blob) throw new Error("Não foi possível processar a imagem");
    if (blob.size > LIMITE_ARMAZENAMENTO) throw new Error("A imagem continua muito grande. Tente outra.");

    return { blob, extensao: EXTENSAO[blob.type] || "jpg", tipo: blob.type };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Converte uma imagem (qualquer formato que o navegador abra) em PNG para o PDF,
 * informando o tamanho original para manter a proporção.
 */
export async function imagemParaPDF(src: string): Promise<{ dataUrl: string; largura: number; altura: number } | null> {
  try {
    const res = await fetch(src, { cache: "no-store" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const local = URL.createObjectURL(blob);
    try {
      const img = await carregarImagem(local);
      // 400 px é nítido no tamanho impresso da logo e deixa o PDF leve
      const escala = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
      const largura = Math.max(1, Math.round(img.naturalWidth * escala));
      const altura = Math.max(1, Math.round(img.naturalHeight * escala));
      const canvas = document.createElement("canvas");
      canvas.width = largura;
      canvas.height = altura;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, largura, altura);
      return { dataUrl: canvas.toDataURL("image/png"), largura, altura };
    } finally {
      URL.revokeObjectURL(local);
    }
  } catch {
    return null;
  }
}
