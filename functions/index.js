const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Payment } = require("mercadopago");

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const mpClient = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || "APP_USR-6761223417522680-102623-72e09b6bce2ebb4cad340a0b008979e7-327248121"
});

// 1. Webhook que recebe a confirmação de pagamento Pix do Mercado Pago
exports.pixWebhook = onRequest(async (req, res) => {
  try {
    const paymentId = req.body?.data?.id || req.query["data.id"] || req.query.id;

    if (!paymentId) {
      return res.status(200).send("Sem ID de pagamento.");
    }

    // Consulta reversa na API do Mercado Pago para evitar requisições falsas
    const paymentInstance = new Payment(mpClient);
    const payment = await paymentInstance.get({ id: paymentId });

    if (payment.status === "approved") {
      const orderId = payment.external_reference;
      if (!orderId) return res.status(200).send("Sem external_reference.");

      // Transação Atômica: Atualiza Pedido + Atualiza Cotas simultaneamente
      await db.runTransaction(async (transaction) => {
        const orderRef = db.collection("orders").doc(orderId);
        const orderDoc = await transaction.get(orderRef);

        if (!orderDoc.exists) throw new Error("Pedido não encontrado.");
        const orderData = orderDoc.data();

        // Idempotência: Evita reprocessamento
        if (orderData.status === "paid") return;

        transaction.update(orderRef, {
          status: "paid",
          paymentId: paymentId,
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          paymentDetails: {
            method: payment.payment_method_id,
            amount: payment.transaction_amount
          }
        });

        const campaignId = orderData.campaign_id;
        orderData.selected_numbers.forEach((num) => {
          const ticketRef = db.collection("tickets").doc(`${campaignId}_${num}`);
          transaction.set(ticketRef, {
            campaign_id: campaignId,
            number: num,
            status: "paid",
            buyer_id: orderData.buyer_phone,
            buyer_name: orderData.buyer_name,
            order_id: orderId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        });
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("Erro no Webhook Pix:", error);
    return res.status(500).json({ error: error.message });
  }
});

// 2. Cron Job para liberar cotas reservadas não pagas após 15 minutos
exports.releaseExpiredTickets = onSchedule("every 5 minutes", async () => {
  const threshold = new Date(Date.now() - 15 * 60 * 1000);

  const snapshot = await db.collection("orders")
    .where("status", "==", "pending")
    .where("createdAt", "<", threshold)
    .get();

  if (snapshot.empty) return;

  const batch = db.batch();
  snapshot.forEach((orderDoc) => {
    const data = orderDoc.data();
    batch.update(orderDoc.ref, { 
      status: "expired", 
      expiredAt: admin.firestore.FieldValue.serverTimestamp() 
    });

    data.selected_numbers.forEach((num) => {
      const ticketRef = db.collection("tickets").doc(`${data.campaign_id}_${num}`);
      batch.update(ticketRef, {
        status: "available",
        buyer_id: null,
        buyer_name: null,
        order_id: null
      });
    });
  });

  await batch.commit();
});
