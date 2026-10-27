/**
 * Utility functions for Rifas GPN
 * Includes ticket generation (1 to 300 numbers), phone formatting, currency formatting, and Pix payload generation.
 */

export function cleanPhone(raw: string): string {
  return (raw || '').replace(/\D/g, '').slice(0, 11);
}

export function cleanCpf(raw: string): string {
  return (raw || '').replace(/\D/g, '').slice(0, 11);
}

export function formatCpf(raw: string): string {
  const digits = cleanCpf(raw);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

export function validateCpf(cpf: string): boolean {
  const digits = cleanCpf(cpf);
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }
  let rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  if (rev !== parseInt(digits[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i);
  }
  rev = 11 - (sum % 11);
  if (rev === 10 || rev === 11) rev = 0;
  return rev === parseInt(digits[10], 10);
}

export function formatPhone(raw: string): string {
  const digits = cleanPhone(raw);
  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function formatCurrency(value: number | string | undefined | null): string {
  const num = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value || 0);
  if (isNaN(num)) return '0,00';
  return num.toFixed(2).replace('.', ',');
}

export function formatTicketNumber(num: number, digits: number = 3): string {
  return String(num).padStart(digits, '0');
}

export function calculateTotal(count: number, pricePerTicket: number): number {
  if (count <= 0 || pricePerTicket <= 0) return 0;
  return Math.round(count * pricePerTicket * 100) / 100;
}

export interface RaffleProgressInfo {
  metaTotal: number;
  arrecadado: number;
  faltamVerba: number;
  faltamNumeros: number;
  percent: number;
}

export function calculateProgress(soldCount: number, totalTickets: number = 300, pricePerTicket: number = 50): RaffleProgressInfo {
  const safeTotal = Math.max(1, totalTickets);
  const safeSold = Math.max(0, Math.min(soldCount, safeTotal));
  const metaTotal = safeTotal * pricePerTicket;
  const arrecadado = safeSold * pricePerTicket;
  const faltamVerba = Math.max(0, metaTotal - arrecadado);
  const faltamNumeros = Math.max(0, safeTotal - safeSold);
  const percent = Math.min(100, Math.round((safeSold / safeTotal) * 1000) / 10);

  return {
    metaTotal,
    arrecadado,
    faltamVerba,
    faltamNumeros,
    percent
  };
}

/**
 * Generates unique random tickets from 1 to totalTickets avoiding unavailable numbers.
 */
export function generateRaffleTickets(
  count: number,
  totalTickets: number = 300,
  unavailableNumbers: Set<number> | number[] = []
): number[] {
  const unavailable = unavailableNumbers instanceof Set 
    ? unavailableNumbers 
    : new Set(unavailableNumbers);

  if (count <= 0) return [];
  if (totalTickets <= 0) return [];

  const availableCount = totalTickets - unavailable.size;
  const requested = Math.min(count, Math.max(0, availableCount));

  const selected = new Set<number>();
  let attempts = 0;
  const maxAttempts = requested * 30;

  while (selected.size < requested && attempts < maxAttempts) {
    attempts++;
    const randomNum = 1 + Math.floor(Math.random() * totalTickets);
    if (!unavailable.has(randomNum) && !selected.has(randomNum)) {
      selected.add(randomNum);
    }
  }

  // If sparse attempts missed due to high occupancy, scan deterministically
  if (selected.size < requested) {
    for (let i = 1; i <= totalTickets && selected.size < requested; i++) {
      if (!unavailable.has(i) && !selected.has(i)) {
        selected.add(i);
      }
    }
  }

  return Array.from(selected).sort((a, b) => a - b);
}

export interface OrderValidationResult {
  isValid: boolean;
  errors: string[];
}

export function validateOrderInput(input: {
  buyerName: string;
  buyerPhone: string;
  count: number;
  pricePerTicket: number;
  buyerCpf?: string;
  buyerEmail?: string;
}): OrderValidationResult {
  const errors: string[] = [];

  const trimmedName = (input.buyerName || '').trim();
  if (trimmedName.length < 3) {
    errors.push('Nome completo deve ter pelo menos 3 caracteres.');
  }

  const phoneDigits = cleanPhone(input.buyerPhone);
  if (phoneDigits.length < 10) {
    errors.push('WhatsApp com DDD inválido (mínimo 10 dígitos).');
  }

  if (input.buyerCpf !== undefined && cleanCpf(input.buyerCpf).length > 0) {
    if (cleanCpf(input.buyerCpf).length !== 11) {
      errors.push('CPF incompleto (deve conter 11 dígitos).');
    }
  }

  if (input.buyerEmail !== undefined && input.buyerEmail.trim().length > 0) {
    if (!validateEmail(input.buyerEmail)) {
      errors.push('E-mail informado é inválido.');
    }
  }

  if (!input.count || input.count <= 0) {
    errors.push('Selecione pelo menos 1 número.');
  }

  if (input.pricePerTicket <= 0) {
    errors.push('Preço por número inválido.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Generates a realistic mock or standard Pix BRCode Copia-e-Cola payload
 */
export function generatePixCode(orderId: string, amount: number, campaignTitle: string = 'GRUPO PART NEGRA'): string {
  const formattedAmount = Number(amount || 0).toFixed(2);
  const cleanId = orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 25).toUpperCase();
  const txid = cleanId || 'PARTNEGRA' + Math.floor(Math.random() * 100000);
  const title = (campaignTitle || 'PART NEGRA').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 25).toUpperCase();
  
  return `00020126580014br.gov.bcb.pix0136123e4567-e89b-12d3-a456-426614174000520400005303986540${formattedAmount.length > 9 ? formattedAmount : ('0' + formattedAmount).slice(-formattedAmount.length - (formattedAmount.length < 10 ? 0 : 0))}${formattedAmount}5802BR59${String(title.length).padStart(2, '0')}${title}6008GOIANIA62070503${txid.slice(0, 10)}6304ABCD`;
}

export interface WhatsAppMessageParams {
  buyerName: string;
  buyerPhone?: string;
  orderId?: string;
  selectedNumbers: number[];
  totalAmount?: number;
  totalTickets?: number;
}

export function formatTicketList(numbers: number[]): string {
  if (!numbers || !numbers.length) return '';
  return numbers
    .slice()
    .sort((a, b) => a - b)
    .map(n => formatTicketNumber(n))
    .join(', ');
}

/**
 * Generates the WhatsApp receipt message complying with:
 * 1. Numbers sent to the buyer to be stored
 * 2. Explaining that the draw will occur once all numbers are sold
 * 3. Instructing them to keep and save the numbers for verification on draw day
 * 4. Stating that they will be alerted on WhatsApp regarding the date/time of the live draw
 */
export function generateWhatsAppTicketMessage({
  buyerName,
  orderId,
  selectedNumbers,
  totalAmount,
  totalTickets = 300
}: WhatsAppMessageParams): string {
  const formattedNumbers = formatTicketList(selectedNumbers);
  const count = selectedNumbers?.length || 0;
  const firstName = buyerName ? buyerName.trim().split(' ')[0] : 'Participante';

  return `🎉 *RIFAS GPN - SEUS BILHETES DA SORTE* 🎉

Olá, *${firstName}*! Aqui estão os seus números confirmados para concorrer ao *Show Completo do Grupo Part Negra*:

🎫 *SEUS NÚMEROS ESCOLHIDOS (${count}):*
👉 *${formattedNumbers}*
${orderId ? `\n📋 *Pedido:* #${orderId.slice(-6).toUpperCase()}` : ''}${totalAmount ? `\n💰 *Total Pago:* R$ ${formatCurrency(totalAmount)}` : ''}

⚠️ *INFORMAÇÕES IMPORTANTES DO SORTEIO:*
1️⃣ *Quando será o sorteio:*
O sorteio oficial será realizado no final da compra de todos os ${totalTickets} números da rifa!

2️⃣ *Guarde para conferência:*
Guarde esta mensagem com os seus números para conferência oficial no dia do sorteio.

3️⃣ *Aviso do Sorteio Ao Vivo:*
Você será avisado diretamente aqui no seu WhatsApp sobre o dia e o horário exato do sorteio ao vivo!

📄 *Comprovante em PDF:*
Você também pode salvar o comprovante oficial em formato PDF emitido no sistema para anexar ou arquivar.

🍀 *Boa sorte! O Grupo Part Negra agradece sua participação!*`;
}

/**
 * Generates direct WhatsApp click-to-chat URL for the buyer's phone
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  const digits = cleanPhone(phone);
  const fullPhone = digits.startsWith('55') && digits.length > 11 ? digits : `55${digits}`;
  return `https://api.whatsapp.com/send?phone=${fullPhone}&text=${encodeURIComponent(message)}`;
}

