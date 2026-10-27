import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { MercadoPagoConfig, Payment } from 'mercadopago';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// =========================================================================
// 1. BANCO DE DADOS CENTRALIZADO DO SERVIDOR (Cross-Device Real-Time Store)
// =========================================================================
const STORE_DIR = path.resolve(__dirname, 'data');
const STORE_FILE = path.resolve(STORE_DIR, 'rifas_store.json');

const DEFAULT_CAMPAIGN = {
  id: 'camp_part_negra',
  title: 'Show Completo do Grupo Part Negra',
  description: 'Que tal ter um show completo do Grupo Part Negra para seu evento, sua confraternização por apenas R$ 59,90 por número! Podendo escolher a data que preferir!',
  price_per_ticket: 59.90,
  total_tickets: 300,
  imageUrl: 'https://i.postimg.cc/PqCc2GLm/fundo.png',
  status: 'active',
  createdAt: new Date().toISOString(),
  featured: true
};

interface ServerStore {
  campaigns: any[];
  orders: any[];
  tickets: any[];
  lastUpdated: number;
}

function loadStore(): ServerStore {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      // Ensure campaign has 59.90 price
      if (Array.isArray(parsed.campaigns)) {
        const camp = parsed.campaigns.find((c: any) => c.id === 'camp_part_negra');
        if (camp) {
          camp.price_per_ticket = 59.90;
        } else {
          parsed.campaigns = [DEFAULT_CAMPAIGN];
        }
      }
      return {
        campaigns: parsed.campaigns || [DEFAULT_CAMPAIGN],
        orders: parsed.orders || [],
        tickets: parsed.tickets || [],
        lastUpdated: parsed.lastUpdated || Date.now()
      };
    }
  } catch (err) {
    console.error('[Store] Erro ao carregar arquivo local:', err);
  }

  const initialStore: ServerStore = {
    campaigns: [DEFAULT_CAMPAIGN],
    orders: [],
    tickets: [],
    lastUpdated: Date.now()
  };
  saveStore(initialStore);
  return initialStore;
}

function saveStore(store: ServerStore) {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true });
    }
    store.lastUpdated = Date.now();
    fs.writeFileSync(STORE_FILE, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Store] Erro ao salvar arquivo local:', err);
  }
}

// In-memory reference for high-throughput responses
const store: ServerStore = loadStore();

// =========================================================================
// 2. SERVER-SENT EVENTS (SSE): Transmissão em Tempo Real para Todos os Aparelhos
// =========================================================================
const sseClients = new Set<express.Response>();

function broadcastStoreUpdate(eventType: string = 'state_change', extraData: any = {}) {
  const payload = JSON.stringify({
    type: eventType,
    state: getPublicState(),
    extra: extraData,
    timestamp: Date.now()
  });

  for (const client of sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

function getPublicState() {
  const soldTickets = new Set<number>();
  const reservedTickets = new Set<number>();

  for (const ord of store.orders) {
    if (ord.status === 'paid' && Array.isArray(ord.selected_numbers)) {
      ord.selected_numbers.forEach((n: number) => soldTickets.add(Number(n)));
    } else if (ord.status === 'pending' && Array.isArray(ord.selected_numbers)) {
      ord.selected_numbers.forEach((n: number) => reservedTickets.add(Number(n)));
    }
  }

  for (const t of store.tickets) {
    if (t.status === 'paid') {
      soldTickets.add(Number(t.number));
    } else if (t.status === 'reserved') {
      reservedTickets.add(Number(t.number));
    }
  }

  const total = store.campaigns[0]?.total_tickets || 300;
  const soldArray = Array.from(soldTickets).sort((a, b) => a - b);
  const reservedArray = Array.from(reservedTickets).sort((a, b) => a - b);

  return {
    campaigns: store.campaigns,
    orders: store.orders,
    tickets: store.tickets,
    soldNumbers: soldArray,
    reservedNumbers: reservedArray,
    totalTickets: total,
    soldCount: soldArray.length,
    availableCount: Math.max(0, total - soldArray.length),
    lastUpdated: store.lastUpdated
  };
}

// Endpoint SSE: Cada aparelho/computador conecta aqui para receber atualizações na hora
app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Envia estado inicial imediato
  const initialPayload = JSON.stringify({
    type: 'initial_state',
    state: getPublicState(),
    timestamp: Date.now()
  });
  res.write(`data: ${initialPayload}\n\n`);

  sseClients.add(res);

  // Heartbeat a cada 25 segundos para manter a conexão ativa
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      sseClients.delete(res);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
});

// Endpoint REST para obter estado completo
app.get('/api/state', (_req, res) => {
  return res.status(200).json({
    status: 'success',
    ...getPublicState()
  });
});

// =========================================================================
// 3. INTEGRAÇÃO MERCADO PAGO SDK (Credenciais Oficiais)
// =========================================================================
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || 'APP_USR-6761223417522680-102623-72e09b6bce2ebb4cad340a0b008979e7-327248121',
  options: { timeout: 10000 }
});

const payment = new Payment(mpClient);

// Salvar / Criar Pedido Centrado no Servidor (visível em todos os aparelhos)
app.post('/api/orders', (req, res) => {
  try {
    const orderData = req.body;
    if (!orderData || !orderData.selected_numbers || !orderData.buyer_name) {
      return res.status(400).json({ status: 'error', message: 'Dados incompletos do pedido.' });
    }

    const orderId = orderData.id || ('ORD-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6));
    const newOrder = {
      ...orderData,
      id: orderId,
      status: orderData.status || 'pending',
      createdAt: orderData.createdAt || new Date().toISOString()
    };

    // Remove duplicates if existing
    const existingIndex = store.orders.findIndex(o => o.id === orderId);
    if (existingIndex >= 0) {
      store.orders[existingIndex] = newOrder;
    } else {
      store.orders.unshift(newOrder);
    }

    // Marca tickets como reservados temporariamente
    if (Array.isArray(newOrder.selected_numbers)) {
      newOrder.selected_numbers.forEach((num: number) => {
        const tIndex = store.tickets.findIndex(t => t.number === num);
        const tData = {
          id: `t_${num}`,
          campaign_id: newOrder.campaign_id || 'camp_part_negra',
          number: num,
          status: newOrder.status === 'paid' ? 'paid' : 'reserved',
          buyer_id: newOrder.buyer_phone,
          buyer_name: newOrder.buyer_name,
          order_id: orderId,
          updatedAt: new Date().toISOString()
        };
        if (tIndex >= 0) {
          store.tickets[tIndex] = tData;
        } else {
          store.tickets.push(tData);
        }
      });
    }

    saveStore(store);
    broadcastStoreUpdate('order_created', { orderId });

    return res.status(200).json({ status: 'success', order: newOrder });
  } catch (err: any) {
    console.error('Erro ao salvar pedido no servidor:', err);
    return res.status(500).json({ status: 'error', message: err?.message });
  }
});

// Baixa Centralizada de Pedido Pago
app.post('/api/mark-paid', (req, res) => {
  try {
    const { orderId, paymentId, paymentDetails } = req.body;
    if (!orderId && !paymentId) {
      return res.status(400).json({ status: 'error', message: 'Identificador do pedido ou pagamento ausente.' });
    }

    const orderIndex = store.orders.findIndex(
      o => o.id === orderId || (paymentId && (o.pix_payment_id === paymentId || o.paymentId === paymentId))
    );

    if (orderIndex < 0) {
      return res.status(404).json({ status: 'error', message: 'Pedido não encontrado.' });
    }

    const order = store.orders[orderIndex];
    const paidAt = new Date().toISOString();

    store.orders[orderIndex] = {
      ...order,
      status: 'paid',
      paidAt,
      paymentId: paymentId || order.paymentId || ('MP-' + Date.now()),
      paymentDetails: paymentDetails || { method: 'pix', amount: order.total_amount }
    };

    // Marca as cotas como vendidas
    if (Array.isArray(order.selected_numbers)) {
      order.selected_numbers.forEach((num: number) => {
        const tIndex = store.tickets.findIndex(t => t.number === num);
        const ticketData = {
          id: `t_${num}`,
          campaign_id: order.campaign_id || 'camp_part_negra',
          number: num,
          status: 'paid',
          buyer_id: order.buyer_phone,
          buyer_name: order.buyer_name,
          order_id: order.id,
          updatedAt: paidAt
        };
        if (tIndex >= 0) {
          store.tickets[tIndex] = ticketData;
        } else {
          store.tickets.push(ticketData);
        }
      });
    }

    saveStore(store);
    broadcastStoreUpdate('order_paid', { orderId: order.id, numbers: order.selected_numbers });

    return res.status(200).json({ status: 'success', order: store.orders[orderIndex] });
  } catch (err: any) {
    console.error('Erro ao dar baixa centralizada:', err);
    return res.status(500).json({ status: 'error', message: err?.message });
  }
});

// Zerar / Restaurar Compras (Admin)
app.post('/api/reset-purchases', (_req, res) => {
  try {
    store.orders = [];
    store.tickets = [];
    saveStore(store);
    broadcastStoreUpdate('purchases_reset');
    return res.status(200).json({ status: 'success', message: 'Todas as compras foram zeradas com sucesso.' });
  } catch (err: any) {
    return res.status(500).json({ status: 'error', message: err?.message });
  }
});

// Gerar Cobrança Pix no Mercado Pago
app.post('/api/pix-rifa', async (req, res) => {
  try {
    const {
      valor_total,
      numeros_selecionados,
      comprador_nome,
      comprador_email,
      comprador_cpf,
      comprador_telefone,
      descricao_rifa,
      order_id
    } = req.body;

    if (!valor_total || !numeros_selecionados || !comprador_email || !comprador_cpf) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Parâmetros obrigatórios ausentes.' 
      });
    }

    const cleanCpfDigits = String(comprador_cpf).replace(/\D/g, '');
    const cleanPhoneDigits = comprador_telefone ? String(comprador_telefone).replace(/\D/g, '') : '';
    const cotasStr = Array.isArray(numeros_selecionados) 
      ? numeros_selecionados.join(', ') 
      : String(numeros_selecionados);

    const names = (comprador_nome || 'Cliente').trim().split(' ');
    const firstName = names[0] || 'Cliente';
    const lastName = names.slice(1).join(' ') || 'Participante';

    const expirationDate = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    const paymentBody = {
      transaction_amount: Number(Number(valor_total).toFixed(2)),
      description: `${descricao_rifa || 'Rifa GPN'} - Bilhetes: [${cotasStr}]`.slice(0, 100),
      payment_method_id: 'pix',
      date_of_expiration: expirationDate,
      payer: {
        email: comprador_email.trim(),
        first_name: firstName,
        last_name: lastName,
        identification: {
          type: 'CPF',
          number: cleanCpfDigits
        }
      },
      metadata: {
        numeros: numeros_selecionados,
        telefone: cleanPhoneDigits,
        order_id: order_id || null
      }
    };

    const mpResponse = await payment.create({ body: paymentBody });
    const transactionData = mpResponse.point_of_interaction?.transaction_data;

    return res.status(200).json({
      status: 'success',
      payment_id: mpResponse.id,
      valor: mpResponse.transaction_amount,
      pix_copia_e_cola: transactionData?.qr_code || '',
      qr_code_base64: transactionData?.qr_code_base64 || '',
      link_pagamento: transactionData?.ticket_url || '',
      expiracao: mpResponse.date_of_expiration || expirationDate
    });
  } catch (error: any) {
    console.error('Erro na criação de Pix Mercado Pago:', error);
    return res.status(500).json({
      status: 'error',
      message: error?.message || 'Falha ao processar pagamento Pix no Mercado Pago.',
      details: error?.cause || null
    });
  }
});

// Consulta de Status do Pix com Baixa Automática no Servidor
app.get('/api/pix-status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    if (!paymentId) {
      return res.status(400).json({ status: 'error', message: 'ID do pagamento não informado.' });
    }

    const mpPayment = await payment.get({ id: String(paymentId) });
    const isApproved = mpPayment.status === 'approved';

    // Se estiver aprovado, dá baixa no servidor automaticamente para sincronizar todas as telas
    if (isApproved) {
      const order = store.orders.find(o => String(o.pix_payment_id) === String(paymentId) || String(o.paymentId) === String(paymentId));
      if (order && order.status !== 'paid') {
        const orderIndex = store.orders.indexOf(order);
        const paidAt = mpPayment.date_approved || new Date().toISOString();
        store.orders[orderIndex] = {
          ...order,
          status: 'paid',
          paidAt,
          paymentId: String(mpPayment.id),
          paymentDetails: { method: 'pix', amount: mpPayment.transaction_amount }
        };

        if (Array.isArray(order.selected_numbers)) {
          order.selected_numbers.forEach((num: number) => {
            const tIndex = store.tickets.findIndex(t => t.number === num);
            const ticketData = {
              id: `t_${num}`,
              campaign_id: order.campaign_id || 'camp_part_negra',
              number: num,
              status: 'paid',
              buyer_id: order.buyer_phone,
              buyer_name: order.buyer_name,
              order_id: order.id,
              updatedAt: paidAt
            };
            if (tIndex >= 0) store.tickets[tIndex] = ticketData;
            else store.tickets.push(ticketData);
          });
        }
        saveStore(store);
        broadcastStoreUpdate('order_paid', { orderId: order.id, paymentId });
      }
    }

    return res.status(200).json({
      status: 'success',
      payment_id: mpPayment.id,
      payment_status: mpPayment.status,
      is_approved: isApproved,
      status_detail: mpPayment.status_detail,
      amount: mpPayment.transaction_amount,
      date_approved: mpPayment.date_approved,
      raw: mpPayment
    });
  } catch (error: any) {
    console.error('Erro ao consultar status no Mercado Pago:', error);
    return res.status(500).json({ status: 'error', message: error?.message });
  }
});

// Verificação em Lote de Pedidos Pendentes contra o Mercado Pago
app.post('/api/check-pending-orders', async (req, res) => {
  try {
    const { orders } = req.body;
    if (!Array.isArray(orders) || orders.length === 0) {
      return res.status(200).json({ status: 'success', approved: [] });
    }

    const approvedList: Array<{ orderId: string; paymentId: string; amount: number; date_approved?: string }> = [];

    for (const item of orders) {
      if (!item.paymentId) continue;
      try {
        const mpPayment = await payment.get({ id: String(item.paymentId) });
        if (mpPayment.status === 'approved') {
          approvedList.push({
            orderId: item.orderId,
            paymentId: String(mpPayment.id),
            amount: Number(mpPayment.transaction_amount || 0),
            date_approved: mpPayment.date_approved
          });

          // Baixa imediata no store
          const order = store.orders.find(o => o.id === item.orderId || String(o.pix_payment_id) === String(item.paymentId));
          if (order && order.status !== 'paid') {
            const orderIndex = store.orders.indexOf(order);
            const paidAt = mpPayment.date_approved || new Date().toISOString();
            store.orders[orderIndex] = {
              ...order,
              status: 'paid',
              paidAt,
              paymentId: String(mpPayment.id)
            };
            if (Array.isArray(order.selected_numbers)) {
              order.selected_numbers.forEach((num: number) => {
                const tIndex = store.tickets.findIndex(t => t.number === num);
                const ticketData = {
                  id: `t_${num}`,
                  campaign_id: order.campaign_id || 'camp_part_negra',
                  number: num,
                  status: 'paid',
                  buyer_id: order.buyer_phone,
                  buyer_name: order.buyer_name,
                  order_id: order.id,
                  updatedAt: paidAt
                };
                if (tIndex >= 0) store.tickets[tIndex] = ticketData;
                else store.tickets.push(ticketData);
              });
            }
          }
        }
      } catch (e) {
        // Silently continue
      }
    }

    if (approvedList.length > 0) {
      saveStore(store);
      broadcastStoreUpdate('batch_orders_paid', { count: approvedList.length });
    }

    return res.status(200).json({ status: 'success', approved: approvedList });
  } catch (error: any) {
    console.error('Erro na checagem em lote:', error);
    return res.status(500).json({ status: 'error', message: error?.message });
  }
});

// Webhook para Notificação Instantânea do Mercado Pago
app.post('/api/webhook/mercadopago', async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
    if (paymentId) {
      const mpPayment = await payment.get({ id: String(paymentId) });
      if (mpPayment.status === 'approved') {
        const order = store.orders.find(o => String(o.pix_payment_id) === String(paymentId) || String(o.paymentId) === String(paymentId));
        if (order && order.status !== 'paid') {
          const orderIndex = store.orders.indexOf(order);
          const paidAt = mpPayment.date_approved || new Date().toISOString();
          store.orders[orderIndex] = {
            ...order,
            status: 'paid',
            paidAt,
            paymentId: String(mpPayment.id)
          };
          if (Array.isArray(order.selected_numbers)) {
            order.selected_numbers.forEach((num: number) => {
              const tIndex = store.tickets.findIndex(t => t.number === num);
              const ticketData = {
                id: `t_${num}`,
                campaign_id: order.campaign_id || 'camp_part_negra',
                number: num,
                status: 'paid',
                buyer_id: order.buyer_phone,
                buyer_name: order.buyer_name,
                order_id: order.id,
                updatedAt: paidAt
              };
              if (tIndex >= 0) store.tickets[tIndex] = ticketData;
              else store.tickets.push(ticketData);
            });
          }
          saveStore(store);
          broadcastStoreUpdate('webhook_order_paid', { orderId: order.id, paymentId });
        }
      }
    }
    return res.status(200).send('OK');
  } catch (err: any) {
    console.error('[Webhook MP] Erro:', err?.message);
    return res.status(200).send('OK');
  }
});

// Integração do Vite SPA
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor Rifas GPN Real-Time rodando na porta ${PORT}`);
  });
}

startServer();
