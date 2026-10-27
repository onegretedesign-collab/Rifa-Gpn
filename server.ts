import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { MercadoPagoConfig, Payment } from 'mercadopago';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

// Inicializa SDK Oficial do Mercado Pago com o Access Token fornecido
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || 'APP_USR-6761223417522680-102623-72e09b6bce2ebb4cad340a0b008979e7-327248121',
  options: { timeout: 10000 }
});

const payment = new Payment(mpClient);

// 1. Endpoint para Gerar Cobrança Pix Oficial no Mercado Pago
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
        message: 'Parâmetros obrigatórios ausentes (valor_total, numeros_selecionados, comprador_email, comprador_cpf).' 
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

    // Data de expiração: 15 minutos a partir de agora
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

// 2. Consulta de Status do Pix Mercado Pago com Detecção de Pagamento Aprovado
app.get('/api/pix-status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    if (!paymentId) {
      return res.status(400).json({ status: 'error', message: 'ID do pagamento não informado.' });
    }

    const mpPayment = await payment.get({ id: String(paymentId) });
    const isApproved = mpPayment.status === 'approved';

    return res.status(200).json({
      status: 'success',
      payment_id: mpPayment.id,
      payment_status: mpPayment.status, // 'approved', 'pending', 'rejected', etc.
      is_approved: isApproved,
      status_detail: mpPayment.status_detail,
      amount: mpPayment.transaction_amount,
      date_approved: mpPayment.date_approved
    });
  } catch (error: any) {
    console.error('Erro ao consultar status no Mercado Pago:', error);
    return res.status(500).json({ status: 'error', message: error?.message });
  }
});

// 3. Verificação em Lote de Pedidos Pendentes contra o Mercado Pago
app.post('/api/check-pending-orders', async (req, res) => {
  try {
    const { orders } = req.body; // Array de { orderId, paymentId }
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
        }
      } catch (e) {
        // Ignora erro individual e continua os demais
      }
    }

    return res.status(200).json({ status: 'success', approved: approvedList });
  } catch (error: any) {
    console.error('Erro na checagem em lote:', error);
    return res.status(500).json({ status: 'error', message: error?.message });
  }
});

// 4. Webhook para Notificação Instantânea de Pagamento (IPN Mercado Pago)
app.post('/api/webhook/mercadopago', async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.query?.['data.id'] || req.query?.id;
    if (paymentId) {
      const mpPayment = await payment.get({ id: String(paymentId) });
      console.log(`[Webhook MP] Notificação recebida para ID: ${paymentId}, Status: ${mpPayment.status}`);
    }
    return res.status(200).send('OK');
  } catch (err: any) {
    console.error('[Webhook MP] Erro:', err?.message);
    return res.status(200).send('OK');
  }
});

// 4. Integração do Vite SPA
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
    console.log(`🚀 Servidor Rifas GPN com Mercado Pago rodando na porta ${PORT}`);
  });
}

startServer();
