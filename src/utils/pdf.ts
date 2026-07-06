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

export function gerarPDFOrcamento(data: PDFData): void {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("ORÇAMENTO", 105, 20, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Nº: ${data.numero}`, 105, 28, { align: "center" });
  doc.text(`Data: ${data.data}`, 105, 34, { align: "center" });
  doc.text(`Validade: ${data.validade}`, 105, 40, { align: "center" });

  // Company
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("EMPRESA:", 14, 55);
  doc.setFont("helvetica", "normal");
  doc.text(data.empresa || "Não informado", 14, 61);

  // Client
  doc.setFont("helvetica", "bold");
  doc.text("CLIENTE:", 14, 73);
  doc.setFont("helvetica", "normal");
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

  // Totals
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text(`Subtotal: R$ ${data.subtotal.toFixed(2).replace(".", ",")}`, 130, finalY);
  if (data.desconto > 0) {
    doc.text(`Desconto: -R$ ${data.desconto.toFixed(2).replace(".", ",")}`, 130, finalY + 7);
  }
  if (data.frete > 0) {
    doc.text(`Frete: R$ ${data.frete.toFixed(2).replace(".", ",")}`, 130, finalY + 14);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`TOTAL: R$ ${data.total.toFixed(2).replace(".", ",")}`, 130, finalY + (data.desconto > 0 ? 21 : 14));

  // Conditions
  let notesY = finalY + (data.desconto > 0 ? 30 : 23);
  if (data.condicoes_gerais) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Condições Gerais:", 14, notesY);
    doc.setFont("helvetica", "normal");
    const splitConditions = doc.splitTextToSize(data.condicoes_gerais, 180);
    doc.text(splitConditions, 14, notesY + 6);
    notesY += 6 + splitConditions.length * 5;
  }
  if (data.observacoes) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Observações:", 14, notesY);
    doc.setFont("helvetica", "normal");
    const splitObs = doc.splitTextToSize(data.observacoes, 180);
    doc.text(splitObs, 14, notesY + 6);
  }

  // Footer
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text("Gerado pelo LUCRIO - Sistema Financeiro", 105, 285, { align: "center" });

  doc.save(`orcamento-${data.numero.replace(/[^a-zA-Z0-9]/g, "")}.pdf`);
}
