import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanPhone,
  formatPhone,
  formatCurrency,
  formatTicketNumber,
  calculateTotal,
  calculateProgress,
  generateRaffleTickets,
  validateOrderInput,
  generatePixCode,
  formatTicketList,
  generateWhatsAppTicketMessage,
  generateWhatsAppLink,
  cleanCpf,
  formatCpf,
  validateCpf,
  validateEmail
} from './raffle';

test('cleanPhone extracts only numbers and limits to 11 digits', () => {
  assert.equal(cleanPhone('(11) 98765-4321'), '11987654321');
  assert.equal(cleanPhone('+55 (62) 99999-1234 ext 99'), '55629999912');
  assert.equal(cleanPhone(''), '');
});

test('formatPhone formats Brazilian phone numbers correctly', () => {
  assert.equal(formatPhone('11987654321'), '(11) 98765-4321');
  assert.equal(formatPhone('1187654321'), '(11) 8765-4321');
  assert.equal(formatPhone('11'), '(11');
  assert.equal(formatPhone('1199'), '(11) 99');
});

test('formatCurrency formats values to Brazilian Real convention', () => {
  assert.equal(formatCurrency(30.0), '30,00');
  assert.equal(formatCurrency(90), '90,00');
  assert.equal(formatCurrency('30.00'), '30,00');
  assert.equal(formatCurrency(0), '0,00');
});

test('formatTicketNumber pads numbers to specified digits (default 3)', () => {
  assert.equal(formatTicketNumber(7), '007');
  assert.equal(formatTicketNumber(42), '042');
  assert.equal(formatTicketNumber(300), '300');
  assert.equal(formatTicketNumber(9, 4), '0009');
});

test('calculateTotal correctly calculates count times price', () => {
  assert.equal(calculateTotal(1, 59.90), 59.90);
  assert.equal(calculateTotal(2, 59.90), 119.80);
  assert.equal(calculateTotal(1, 50.0), 50.0);
  assert.equal(calculateTotal(3, 50.0), 150.0);
  assert.equal(calculateTotal(10, 50.0), 500.0);
});

test('calculateProgress calculates metaTotal, arrecadado, faltamVerba, faltamNumeros, percent', () => {
  // 30 sold out of 300 at R$ 50 each
  const prog = calculateProgress(30, 300, 50);
  assert.equal(prog.metaTotal, 15000);
  assert.equal(prog.arrecadado, 1500);
  assert.equal(prog.faltamVerba, 13500);
  assert.equal(prog.faltamNumeros, 270);
  assert.equal(prog.percent, 10.0);

  // 300 sold out of 300 (completed)
  const progFull = calculateProgress(300, 300, 50);
  assert.equal(progFull.metaTotal, 15000);
  assert.equal(progFull.arrecadado, 15000);
  assert.equal(progFull.faltamVerba, 0);
  assert.equal(progFull.faltamNumeros, 0);
  assert.equal(progFull.percent, 100);
});

test('generateRaffleTickets generates unique random tickets from 1 to 300 avoiding unavailable ones', () => {
  const unavailable = [1, 2, 3];
  const tickets = generateRaffleTickets(5, 300, unavailable);
  assert.equal(tickets.length, 5);
  
  // All should be distinct
  const unique = new Set(tickets);
  assert.equal(unique.size, 5);

  // None should be in unavailable
  for (const t of tickets) {
    assert.ok(!unavailable.includes(t), `Ticket ${t} should not be unavailable`);
    assert.ok(t >= 1 && t <= 300, `Ticket ${t} should be between 1 and 300`);
  }
});

test('validateOrderInput correctly validates inputs', () => {
  const valid = validateOrderInput({
    buyerName: 'Carlos Silva',
    buyerPhone: '(11) 98888-7777',
    count: 2,
    pricePerTicket: 30.0
  });
  assert.equal(valid.isValid, true);
  assert.equal(valid.errors.length, 0);

  const invalid = validateOrderInput({
    buyerName: 'Al',
    buyerPhone: '123',
    count: 0,
    pricePerTicket: 0
  });
  assert.equal(invalid.isValid, false);
  assert.ok(invalid.errors.length >= 3);
});

test('generatePixCode generates valid code string with amount and title', () => {
  const code = generatePixCode('ORDER123456', 90.00, 'GRUPO PART NEGRA');
  assert.ok(code.startsWith('00020126580014br.gov.bcb.pix'));
  assert.ok(code.includes('PART NEGRA'));
});

test('formatTicketList formats and sorts ticket numbers with leading zeros', () => {
  assert.equal(formatTicketList([42, 7, 300]), '007, 042, 300');
  assert.equal(formatTicketList([]), '');
});

test('generateWhatsAppTicketMessage includes all 4 user required points', () => {
  const message = generateWhatsAppTicketMessage({
    buyerName: 'João da Silva',
    orderId: 'abc123xyz',
    selectedNumbers: [5, 42, 100],
    totalAmount: 150,
    totalTickets: 300
  });

  // 1. Chosen numbers formatted to be saved
  assert.ok(message.includes('005, 042, 100'), 'Must contain the formatted ticket numbers');
  assert.ok(message.includes('SEUS NÚMEROS ESCOLHIDOS (3)'), 'Must mention count of chosen numbers');

  // 2. Explaining that it will be drawn at the end of all numbers sold
  assert.ok(
    message.toLowerCase().includes('final da compra de todos os 300 números'),
    'Must explain that draw happens when all numbers are sold'
  );

  // 3. Storing for verification on the day of the draw
  assert.ok(
    message.toLowerCase().includes('para conferência oficial no dia do sorteio'),
    'Must instruct buyer to save numbers for verification on draw day'
  );

  // 4. Notification on WhatsApp about the live draw
  assert.ok(
    message.toLowerCase().includes('avisado diretamente aqui no seu whatsapp sobre o dia e o horário exato do sorteio ao vivo'),
    'Must notify that buyer will be alerted on WhatsApp about live draw date/time'
  );
});

test('generateWhatsAppLink generates standard api.whatsapp.com URL with 55 country prefix', () => {
  const msg = 'Teste de mensagem';
  const url = generateWhatsAppLink('(62) 99999-1234', msg);
  assert.ok(url.startsWith('https://api.whatsapp.com/send?phone=5562999991234'));
  assert.ok(url.includes(encodeURIComponent(msg)));
});

test('cleanCpf and formatCpf format Brazilian CPF numbers correctly', () => {
  assert.equal(cleanCpf('123.456.789-01'), '12345678901');
  assert.equal(formatCpf('12345678901'), '123.456.789-01');
  assert.equal(formatCpf('123'), '123');
  assert.equal(formatCpf('123456'), '123.456');
});

test('validateEmail validates email addresses according to standards', () => {
  assert.equal(validateEmail('cliente@gmail.com'), true);
  assert.equal(validateEmail('contato.gpn@empresa.com.br'), true);
  assert.equal(validateEmail('invalido'), false);
  assert.equal(validateEmail('@semusuario.com'), false);
  assert.equal(validateEmail(''), false);
});


