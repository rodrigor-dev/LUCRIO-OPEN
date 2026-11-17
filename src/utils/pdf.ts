import jsPDF from "jspdf";
import { applyPlugin } from "jspdf-autotable";
import { imagemParaPDF } from "@/lib/imagem";

// A partir da v5, o jspdf-autotable só se conecta automaticamente ao jsPDF
// se existir uma variável global `window.jsPDF` — o que não é o caso aqui,
// já que importamos o jsPDF como módulo comum. Sem esta linha, doc.autoTable
// não existe de verdade e a geração do PDF falha silenciosamente antes de
// salvar ou abrir para impressão.
applyPlugin(jsPDF);

interface PDFData {
  numero: string;
  empresa: string;
  cliente: string;
  data: string;
  validade: string;
  itens: Array<{
    descricao: string;
    quantidade: number;
    valor_unitario: number;
    total: number;
  }>;
  subtotal: number;
  desconto: number;
  frete: number;
  total: number;
  condicoes_gerais?: string;
  observacoes?: string;
  logoUrl?: string;
  /** Dados da empresa (Configurações > Negócio) */
  empresaDocumento?: string;
  empresaTelefone?: string;
  empresaEmail?: string;
  empresaEndereco?: string;
}

// Fonte com acentos (Liberation Sans, licença livre). Os arquivos são baixados
// uma vez e reaproveitados; cada PDF novo precisa registrar a fonte de novo.
const FONTES = [
  { arquivo: "LiberationSans-Regular.ttf", estilo: "normal" },
  { arquivo: "LiberationSans-Bold.ttf", estilo: "bold" },
] as const;
let fontesBase64: Record<string, string> | null = null;
let fontLoaded = false;

async function baixarFontes(): Promise<Record<string, string> | null> {
  if (fontesBase64) return fontesBase64;
  const resultado: Record<string, string> = {};
  for (const f of FONTES) {
    const res = await fetch(`/fonts/${f.arquivo}`);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    // Confere se é mesmo uma fonte TrueType (evita quebrar o PDF)
    const ehTTF = bytes.length > 4 && bytes[0] === 0 && bytes[1] === 1 && bytes[2] === 0 && bytes[3] === 0;
    if (!ehTTF) return null;
    let binary = "";
    const bloco = 0x8000;
    for (let i = 0; i < bytes.length; i += bloco) {
      binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + bloco)));
    }
    resultado[f.arquivo] = btoa(binary);
  }
  fontesBase64 = resultado;
  return resultado;
}

async function loadFont(doc: jsPDF) {
  fontLoaded = false;
  try {
    const fontes = await baixarFontes();
    if (!fontes) return;
    for (const f of FONTES) {
      doc.addFileToVFS(f.arquivo, fontes[f.arquivo]);
      doc.addFont(f.arquivo, "Liberation", f.estilo);
    }
    fontLoaded = true;
  } catch (e) {
    console.error("Erro ao carregar fonte para PDF:", e);
    fontLoaded = false;
  }
}

export async function gerarPDFOrcamento(data: PDFData, acao: "baixar" | "imprimir" = "baixar"): Promise<void> {
  const doc = new jsPDF();
  await loadFont(doc);

  let logoHeight = 0;
  if (data.logoUrl) {
    // Converte para PNG (aceita JPG, PNG e WebP) e mantém a proporção da logo
    const logo = await imagemParaPDF(data.logoUrl);
    if (logo) {
      try {
        const maxL = 40;
        const maxA = 25;
        const escala = Math.min(maxL / logo.largura, maxA / logo.altura);
        const largura = logo.largura * escala;
        const altura = logo.altura * escala;
        doc.addImage(logo.dataUrl, "PNG", 14, 10 + (maxA - altura) / 2, largura, altura);
        logoHeight = 30;
      } catch (e) {
        console.error("Erro ao inserir logo no PDF:", e);
      }
    }
  }

  const fontName = fontLoaded ? "Liberation" : "helvetica";

  // Header
  doc.setFontSize(20);
  doc.setFont(fontName, "bold");
  doc.text("ORÇAMENTO", 105, 20 + logoHeight, { align: "center" });

  doc.setFontSize(10);
  doc.setFont(fontName, "normal");
  doc.text(`Nº: ${data.numero}`, 105, 28 + logoHeight, { align: "center" });
  doc.text(`Data: ${data.data}`, 105, 34 + logoHeight, { align: "center" });
  doc.text(`Validade: ${data.validade}`, 105, 40 + logoHeight, { align: "center" });

  // Company
  let y = 55 + logoHeight;
  doc.setFontSize(11);
  doc.setFont(fontName, "bold");
  doc.text("EMPRESA:", 14, y);
  doc.setFont(fontName, "normal");
  y += 6;
  doc.text(data.empresa || "Não informado", 14, y);

  const detalhesEmpresa: string[] = [];
  if (data.empresaDocumento) {
    const digitos = data.empresaDocumento.replace(/\D/g, "");
    detalhesEmpresa.push(`${digitos.length === 14 ? "CNPJ" : "CPF"}: ${data.empresaDocumento}`);
  }
  const contato = [data.empresaTelefone, data.empresaEmail].filter(Boolean).join("  |  ");
  if (contato) detalhesEmpresa.push(contato);
  if (data.empresaEndereco) detalhesEmpresa.push(...doc.splitTextToSize(data.empresaEndereco, 180));
  if (detalhesEmpresa.length) {
    doc.setFontSize(9);
    for (const linha of detalhesEmpresa) {
      y += 5;
      doc.text(linha, 14, y);
    }
    doc.setFontSize(11);
  }

  // Client
  y += 12;
  doc.setFont(fontName, "bold");
  doc.text("CLIENTE:", 14, y);
  doc.setFont(fontName, "normal");
  y += 6;
  doc.text(data.cliente || "Não informado", 14, y);
  const inicioTabela = y + 9;

  // Items table
  const tableBody = data.itens.map((item, i) => [
    String(i + 1),
    item.descricao,
    String(item.quantidade),
    `R$ ${item.valor_unitario.toFixed(2).replace(".", ",")}`,
    `R$ ${item.total.toFixed(2).replace(".", ",")}`,
  ]);

  (doc as any).autoTable({
    startY: inicioTabela,
    head: [["#", "Descrição", "Qtd", "Valor Unit.", "Total"]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 9, font: fontName },
    columnStyles: {
      0: { cellWidth: 10 },
      2: { cellWidth: 15, halign: "center" },
      3: { cellWidth: 30, halign: "right" },
      4: { cellWidth: 30, halign: "right" },
    },
  });

  const finalY = (doc as any).lastAutoTable.finalY + 10;

  // Check if content exceeds page, add new page if needed
  const pageHeight = doc.internal.pageSize.getHeight();
  if (finalY + 60 > pageHeight) {
    doc.addPage();
  }

  const startY = finalY > pageHeight - 60 ? 20 : finalY;

  // Totals
  doc.setFontSize(11);
  doc.setFont(fontName, "normal");
  doc.text(`Subtotal: R$ ${data.subtotal.toFixed(2).replace(".", ",")}`, 130, startY);
  if (data.desconto > 0) {
    doc.text(`Desconto: -R$ ${data.desconto.toFixed(2).replace(".", ",")}`, 130, startY + 7);
  }
  if (data.frete > 0) {
    doc.text(`Frete: R$ ${data.frete.toFixed(2).replace(".", ",")}`, 130, startY + 14);
  }
  doc.setFont(fontName, "bold");
  doc.setFontSize(13);
  doc.text(`TOTAL: R$ ${data.total.toFixed(2).replace(".", ",")}`, 130, startY + (data.desconto > 0 ? 21 : 14));

  // Conditions
  let notesY = startY + (data.desconto > 0 ? 30 : 23);
  if (data.condicoes_gerais) {
    doc.setFontSize(10);
    doc.setFont(fontName, "bold");
    doc.text("Condições Gerais:", 14, notesY);
    doc.setFont(fontName, "normal");
    const splitConditions = doc.splitTextToSize(data.condicoes_gerais, 180);
    doc.text(splitConditions, 14, notesY + 6);
    notesY += 6 + splitConditions.length * 5;
  }
  if (data.observacoes) {
    doc.setFontSize(10);
    doc.setFont(fontName, "bold");
    doc.text("Observações:", 14, notesY);
    doc.setFont(fontName, "normal");
    const splitObs = doc.splitTextToSize(data.observacoes, 180);
    doc.text(splitObs, 14, notesY + 6);
  }

  // Footer
  doc.setFontSize(8);
  doc.setFont(fontName, "normal");
  doc.text("Gerado pelo FATURION - Sistema Financeiro", 105, 285, { align: "center" });

  if (acao === "imprimir") {
    const blobUrl = doc.output("bloburl");
    const opened = window.open(blobUrl, "_blank");
    if (!opened) {
      doc.save(`orcamento-${data.numero.replace(/[^a-zA-Z0-9]/g, "")}.pdf`);
    }
  } else {
    doc.save(`orcamento-${data.numero.replace(/[^a-zA-Z0-9]/g, "")}.pdf`);
  }
}
