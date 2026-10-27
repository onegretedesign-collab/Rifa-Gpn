import { jsPDF } from 'jspdf';
import { formatCurrency, formatTicketNumber, formatCpf, formatPhone } from './raffle';

export interface ReceiptPdfData {
  id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_cpf?: string;
  buyer_email?: string;
  selected_numbers: number[];
  total_amount: number;
  paidAt?: string;
  createdAt?: string;
  paymentId?: string;
  pix_payment_id?: string | number;
  campaign_title?: string;
}

/**
 * Generates an official, high-quality PDF voucher for the buyer to save and share via WhatsApp
 */
export function generateReceiptPdf(order: ReceiptPdfData): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - (margin * 2);

  // Background style
  doc.setFillColor(15, 23, 42); // Dark slate header
  doc.rect(0, 0, pageWidth, 42, 'F');

  // Emerald accent top line
  doc.setFillColor(16, 185, 129); // emerald-500
  doc.rect(0, 0, pageWidth, 3, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('RIFAS GPN • GRUPO PART NEGRA', margin, 18);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(209, 213, 219);
  doc.text('COMPROVANTE OFICIAL DE PARTICIPAÇÃO', margin, 26);

  const orderCode = `#${(order.id || '000000').slice(-6).toUpperCase()}`;
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(52, 211, 153);
  doc.text(`PEDIDO ${orderCode}`, pageWidth - margin, 26, { align: 'right' });

  // Subtitle / Date
  const dateValue = order.paidAt || order.createdAt;
  const dateFormatted = dateValue
    ? new Date(dateValue).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleString('pt-BR');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text(`Emitido em: ${dateFormatted}`, margin, 34);

  // Status Box (Emerald)
  let y = 50;
  doc.setFillColor(236, 253, 245); // emerald-50
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

  doc.setTextColor(4, 120, 87);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('✓ PAGAMENTO CONFIRMADO • LIQUIDAÇÃO PIX MERCADO PAGO', margin + 5, y + 9);

  // Section 1: Dados da Rifa e Participante
  y += 22;
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Dados da Rifa e do Participante', margin, y);

  y += 3;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);

  y += 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Prêmio:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text('Show Completo do Grupo Part Negra (Data à Escolha)', margin + 30, y);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Comprador:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(order.buyer_name || 'Participante', margin + 30, y);

  if (order.buyer_cpf) {
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('CPF:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(formatCpf(order.buyer_cpf), margin + 30, y);
  }

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('WhatsApp:', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.text(formatPhone(order.buyer_phone), margin + 30, y);

  if (order.buyer_email) {
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.text('E-mail:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.text(order.buyer_email, margin + 30, y);
  }

  const paymentIdStr = String(order.paymentId || order.pix_payment_id || 'Mercado Pago');
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Transação Pix:', margin, y);
  doc.setFont('courier', 'normal');
  doc.text(paymentIdStr, margin + 30, y);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.text('Total Pago:', margin, y);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(5, 150, 105);
  doc.text(`R$ ${formatCurrency(order.total_amount)} (${order.selected_numbers.length} cota(s) a R$ 59,90)`, margin + 30, y);

  // Section 2: Números da Sorte Box
  y += 14;
  doc.setTextColor(17, 24, 39);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Seus Números da Sorte (${order.selected_numbers.length} Bilhetes)`, margin, y);

  y += 3;
  doc.line(margin, y, pageWidth - margin, y);

  y += 6;
  const numbersSorted = [...(order.selected_numbers || [])].sort((a, b) => Number(a) - Number(b));
  const cols = 6;
  const cellWidth = contentWidth / cols;
  const cellHeight = 9;

  let currentX = margin;
  let currentY = y;

  numbersSorted.forEach((num, index) => {
    // Number badge background
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(209, 213, 219);
    doc.setLineWidth(0.3);
    doc.roundedRect(currentX + 1, currentY + 1, cellWidth - 2, cellHeight - 2, 1.5, 1.5, 'FD');

    // Number text
    doc.setTextColor(4, 120, 87);
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    doc.text(formatTicketNumber(num), currentX + (cellWidth / 2), currentY + 6, { align: 'center' });

    if ((index + 1) % cols === 0) {
      currentX = margin;
      currentY += cellHeight;
    } else {
      currentX += cellWidth;
    }
  });

  if (numbersSorted.length % cols !== 0) {
    currentY += cellHeight;
  }

  // Section 3: Regulamento Oficial e Transmissão
  y = Math.max(currentY + 10, y + 35);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 38, 2, 2, 'FD');

  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Regulamento Oficial & Instruções do Sorteio:', margin + 5, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text('1. O sorteio oficial será realizado após a venda e quitação de todos os 300 números da rifa.', margin + 5, y + 15);
  doc.text('2. Guarde este comprovante em PDF e seus números para conferência oficial no dia da apuração.', margin + 5, y + 22);
  doc.text('3. O participante será notificado no WhatsApp sobre a data e horário da transmissão ao vivo do sorteio.', margin + 5, y + 29);

  // Footer bar
  y += 46;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Rifas GPN • Documento gerado eletronicamente para arquivamento e envio via WhatsApp.', margin, y);

  return doc;
}

/**
 * Downloads the PDF directly to user's device
 */
export function downloadReceiptPdf(order: ReceiptPdfData) {
  const doc = generateReceiptPdf(order);
  const fileName = `Comprovante_Rifa_GPN_Pedido_${(order.id || 'recibo').slice(-6).toUpperCase()}.pdf`;
  doc.save(fileName);
}
