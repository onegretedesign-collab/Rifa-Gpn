import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, markOrderAsPaid, simulatePixPaymentConfirmation } from '../services/firebaseConfig';
import { CheckCircle2, Copy, Check, Clock, Loader2, ArrowLeft, Zap, ShieldCheck, Sparkles, MessageCircle, ExternalLink, RefreshCw, Ticket, CheckCheck, FileDown } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency, formatTicketNumber, formatCpf, generateWhatsAppTicketMessage, generateWhatsAppLink } from '../utils/raffle';
import { downloadReceiptPdf } from '../utils/pdfReceipt';
import confetti from 'canvas-confetti';
import { useToast } from '../components/Toast';

export default function PixPayment() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // 15 minutes countdown
  const [autoOpenedWa, setAutoOpenedWa] = useState<boolean>(false);
  const pollIntervalRef = useRef<any>(null);

  // Real-time listener for order status changes
  useEffect(() => {
    if (!orderId) return;
    const orderRef = doc(db, 'orders', orderId);

    const unsubscribe = onSnapshot(orderRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOrder({ id: docSnap.id, ...data });
        setLoading(false);

        if (data.status === 'paid') {
          setIsSuccess(true);
          try {
            confetti({
              particleCount: 90,
              spread: 70,
              origin: { y: 0.6 }
            });
          } catch (e) {
            // ignore confetti in non-browser environment
          }
        } else if (data.status === 'expired') {
          navigate('/');
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [orderId, navigate]);

  // Active Real-Time Polling: Checks Mercado Pago API every 2.5s while pending
  useEffect(() => {
    if (!order || order.status !== 'pending' || isSuccess) {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      return;
    }

    const paymentId = order.pix_payment_id || order.paymentId;
    if (!paymentId) return;

    const checkPayment = async () => {
      try {
        const res = await fetch(`/api/pix-status/${paymentId}`);
        if (res.ok) {
          const result = await res.json();
          if (result.is_approved || result.payment_status === 'approved') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            await markOrderAsPaid(order.id || orderId!, String(paymentId), result.raw);
            setIsSuccess(true);
            toast.success('Pagamento Pix aprovado com sucesso!', 'Pix Confirmado');
          }
        }
      } catch (err) {
        // silent retry
      }
    };

    pollIntervalRef.current = setInterval(checkPayment, 2500);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [order?.status, order?.pix_payment_id, order?.paymentId, isSuccess, order?.id, orderId, toast]);

  // Auto-open WhatsApp on approval
  useEffect(() => {
    if (isSuccess && order && !autoOpenedWa && order.buyer_phone) {
      setAutoOpenedWa(true);
      const waMsg = generateWhatsAppTicketMessage({
        buyerName: order.buyer_name,
        buyerPhone: order.buyer_phone,
        orderId: order.id || orderId,
        selectedNumbers: order.selected_numbers || [],
        totalAmount: order.total_amount,
        totalTickets: 300
      });
      const waUrl = generateWhatsAppLink(order.buyer_phone, waMsg);

      const timer = setTimeout(() => {
        window.open(waUrl, '_blank', 'noopener,noreferrer');
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [isSuccess, order, autoOpenedWa, orderId]);

  // Countdown timer for expiration
  useEffect(() => {
    if (isSuccess) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isSuccess]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleCopy = () => {
    if (!order?.pix_code) return;
    navigator.clipboard.writeText(order.pix_code);
    setCopied(true);
    toast.info('Código Pix Copia e Cola copiado com sucesso!', 'Chave Pix');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualCheckStatus = async () => {
    const paymentId = order?.pix_payment_id || order?.paymentId;
    if (!paymentId) return;

    setIsCheckingStatus(true);
    try {
      const res = await fetch(`/api/pix-status/${paymentId}`);
      if (res.ok) {
        const result = await res.json();
        if (result.is_approved || result.payment_status === 'approved') {
          await markOrderAsPaid(order.id || orderId!, String(paymentId), result.raw);
          setIsSuccess(true);
          toast.success('Pagamento identificado e aprovado!', 'Sucesso');
        } else {
          toast.info(
            `Status atual: ${result.payment_status || 'Aguardando'}. Assim que o banco confirmar, a tela atualizará automaticamente.`,
            'Aguardando Liquidação'
          );
        }
      } else {
        toast.error('Não foi possível verificar no momento. Tente novamente em alguns segundos.');
      }
    } catch (err) {
      toast.error('Erro de conexão ao verificar status.');
    } finally {
      setIsCheckingStatus(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!orderId) return;
    setIsSimulating(true);
    try {
      await simulatePixPaymentConfirmation(orderId);
      setIsSuccess(true);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao confirmar pagamento de teste.');
    } finally {
      setIsSimulating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Visual state when payment is approved: auto-notified with direct WhatsApp and receipt
  if (isSuccess && order) {
    const waMsg = generateWhatsAppTicketMessage({
      buyerName: order.buyer_name,
      buyerPhone: order.buyer_phone,
      orderId: order.id || orderId,
      selectedNumbers: order.selected_numbers || [],
      totalAmount: order.total_amount,
      totalTickets: 300
    });
    const waUrl = generateWhatsAppLink(order.buyer_phone, waMsg);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 py-12 bg-neutral-950">
        <div className="w-full max-w-md bg-neutral-900 border border-emerald-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
          {/* Success Check Icon */}
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shadow-xl shadow-emerald-500/20 animate-bounce">
            <CheckCircle2 className="w-12 h-12 stroke-[2.5]" />
          </div>

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 inline-block mb-2">
              Liquidação Mercado Pago Concluída
            </span>
            <h2 className="text-2xl font-black text-white">Pagamento Confirmado!</h2>
            <p className="text-xs text-neutral-300 mt-1 max-w-sm mx-auto">
              Parabéns, <strong className="text-white">{order.buyer_name}</strong>! Seus números da sorte já foram registrados e reservados no banco de dados.
            </p>
          </div>

          {/* Reserved Numbers Card */}
          <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-left space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-400 font-semibold flex items-center gap-1.5">
                <Ticket className="w-4 h-4 text-emerald-400" />
                Seus Bilhetes Emitidos:
              </span>
              <span className="text-emerald-400 font-mono font-bold text-xs">
                {order.selected_numbers?.length} número(s)
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {order.selected_numbers?.map((num: number) => (
                <span
                  key={num}
                  className="px-2.5 py-1 bg-neutral-900 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-xs rounded-xl shadow-sm"
                >
                  {formatTicketNumber(num)}
                </span>
              ))}
            </div>
          </div>

          {/* WhatsApp Direct Action Button */}
          <div className="space-y-2 pt-1">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => toast.success('Abrindo WhatsApp!', 'WhatsApp')}
              className="w-full py-3.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-[0.98] cursor-pointer"
            >
              <MessageCircle className="w-4 h-4 fill-current" />
              <span>Salvar Meus Bilhetes no WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={() => {
                downloadReceiptPdf(order);
                toast.success('Comprovante em PDF baixado com sucesso! Agora você pode anexar no WhatsApp.', 'PDF Oficial');
              }}
              className="w-full py-3 px-3 bg-neutral-950 hover:bg-neutral-800 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <FileDown className="w-4 h-4 text-emerald-400" />
              <span>Baixar Comprovante em PDF (Para Enviar no WhatsApp)</span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <Link
                to={`/comprovante/${order.id || orderId}`}
                className="py-3 px-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-semibold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <span>Ver Comprovante</span>
                <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              </Link>

              <Link
                to="/meus-bilhetes"
                className="py-3 px-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-semibold rounded-2xl text-xs flex items-center justify-center gap-1.5 transition"
              >
                <span>Consultar Cotas</span>
              </Link>
            </div>
          </div>

          {/* Live draw rule note */}
          <p className="text-[10px] text-neutral-500 leading-relaxed font-sans pt-2 border-t border-neutral-800">
            O sorteio oficial será realizado após a venda de todos os 300 números. Você receberá o aviso do sorteio ao vivo pelo WhatsApp cadastrado.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center p-4 pb-12">
      {/* Top back button */}
      <div className="w-full max-w-md flex items-center justify-between py-2 mb-2">
        <Link to="/" className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition">
          <ArrowLeft className="w-4 h-4" /> Cancelar e voltar
        </Link>
        <span className="text-xs font-mono text-neutral-500">
          Pedido #{orderId?.slice(-6).toUpperCase()}
        </span>
      </div>

      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl p-6 shadow-2xl space-y-6">
        {/* Status Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
          <div>
            <span className="text-xs font-bold text-white block">Rifas GPN</span>
            <span className="text-[10px] text-neutral-500 font-mono">
              Pagamento Pix Mercado Pago
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-semibold px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full">
            <Clock className="w-3.5 h-3.5" />
            <span>Expira em {formattedTime}</span>
          </div>
        </div>

        {/* Amount to pay */}
        <div className="text-center py-2">
          <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">
            Valor Total a Pagar
          </p>
          <p className="text-3xl font-black text-white mt-1 font-mono tracking-tight text-emerald-400">
            R$ {formatCurrency(order?.total_amount)}
          </p>
          <div className="mt-2 inline-flex flex-col items-center gap-1 px-3 py-1.5 bg-neutral-950 rounded-2xl border border-neutral-800 text-[11px] text-neutral-400 font-mono">
            <span>{order?.selected_numbers?.length} número(s) para {order?.buyer_name}</span>
            {order?.buyer_cpf && (
              <span className="text-[10px] text-neutral-500 font-sans">
                CPF: {formatCpf(order.buyer_cpf)} {order?.buyer_email ? `• ${order.buyer_email}` : ''}
              </span>
            )}
          </div>
        </div>

        {/* QR Code Container */}
        <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-inner">
          <QRCodeSVG
            value={order?.pix_code || '00020126580014br.gov.bcb.pix'}
            size={180}
            level="M"
            className="rounded"
          />
          <p className="text-[10px] text-neutral-600 font-medium mt-2">
            Abra seu app do banco e escaneie o código
          </p>
        </div>

        {/* Pix Copia e Cola */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold">
            <span>Código Pix Copia e Cola:</span>
            {copied && (
              <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                <Check className="w-3.5 h-3.5 stroke-[3]" /> Copiado para a área de transferência!
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type="text"
              readOnly
              value={order?.pix_code || ''}
              className={`w-full bg-neutral-950 border rounded-xl px-3 py-3 text-xs font-mono truncate focus:outline-none select-all transition ${
                copied ? 'border-emerald-500 text-emerald-300' : 'border-neutral-800 text-neutral-400'
              }`}
            />
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20 active:scale-[0.99] cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Chave Copiada com Sucesso!' : 'Copiar Chave Pix'}
          </button>
        </div>

        {/* Automatic detection notice & Manual Check Button */}
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-neutral-400 pt-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>Identificando pagamento no banco em tempo real...</span>
          </div>

          <button
            type="button"
            disabled={isCheckingStatus}
            onClick={handleManualCheckStatus}
            className="w-full py-2.5 px-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-300 hover:text-white flex items-center justify-center gap-1.5 transition cursor-pointer"
          >
            {isCheckingStatus ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Já paguei, verificar agora</span>
          </button>
        </div>

        {/* Instant Sandbox/Test Payment Simulator Button */}
        <div className="pt-2 border-t border-neutral-800/80">
          <div className="bg-neutral-950 border border-emerald-500/20 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Ambiente de Teste / Simulação Pix
              </span>
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                Webhook Mercado Pago
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 leading-relaxed">
              Deseja testar a baixa imediata sem transferir dinheiro real? Clique abaixo para disparar o webhook de aprovação atômica:
            </p>
            <button
              type="button"
              disabled={isSimulating}
              onClick={handleSimulatePayment}
              className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-emerald-500/40 text-emerald-400 hover:text-emerald-300 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
            >
              {isSimulating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              )}
              Simular Confirmação do Pix Agora
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
