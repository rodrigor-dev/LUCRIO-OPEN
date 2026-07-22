import jsPDF from "jspdf";
import "jspdf-autotable";

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
}

let fontLoaded = false;

async function loadFont(doc: jsPDF) {
  if (fontLoaded) return;
  try {
    const res = await fetch("/fonts/LiberationSans-Regular.ttf");
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    doc.addFileToVFS("LiberationSans-Regular.ttf", base64);
    doc.addFont("LiberationSans-Regular.ttf", "Liberation", "normal");
    fontLoaded = true;
  } catch (e) {
    console.error("Erro ao carregar fonte para PDF:", e);
  }
}

export async function gerarPDFOrcamento(data: PDFData, acao: "baixar" | "imprimir" = "baixar"): Promise<void> {
  const doc = new jsPDF();
  await loadFont(doc);

  const fontName = fontLoaded ? "Liberation" : "times";

  // Header
  doc.setFontSize(20);
  doc.setFont(fontName, "bold");
  doc.text("ORÇAMENTO", 105, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setFont(fontName, "normal");
  doc.text(`Nº: ${data.numero}`, 105, 28, { align: "center" });
  doc.text(`Data: ${data.data}`, 105, 34, { align: "center" });
  doc.text(`Validade: ${data.validade}`, 105, 40, { align: "center" });

  // Company
  doc.setFontSize(11);
  doc.setFont(fontName, "bold");
  doc.text("EMPRESA:", 14, 55);
  doc.setFont(fontName, "normal");
  doc.text(data.empresa || "Não informado", 14, 61);

  // Client
  doc.setFont(fontName, "bold");
  doc.text("CLIENTE:", 14, 73);
  doc.setFont(fontName, "normal");
  doc.text(data.cliente || "Não informado", 14, 79);

  // Items table
  const tableBody = data.itens.map((item, i) => [
    String(i + 1),
    item.descricao,
    String(item.quantidade),
    `R$ ${item.valor_unitario.toFixed(2).replace(".", ",")}`,
    `R$ ${item.total.toFixed(2).replace(".", ",")}`,
  ]);

  (doc as any).autoTable({
    startY: 88,
    head: [["#", "Descrição", "Qtd", "Valor Unit.", "Total"]],
    body: tableBody,
    theme: "grid",
    headStyles: { fillColor: [16, 185, 129] },
    styles: { fontSize: 9 },
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
