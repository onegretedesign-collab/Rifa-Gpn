import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, simulatePixPaymentConfirmation } from '../services/firebaseConfig';
import { CheckCircle2, Copy, Check, Clock, Loader2, ArrowLeft, Zap, ShieldAlert, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { formatCurrency, formatTicketNumber, formatCpf } from '../utils/raffle';
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
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // 15 minutes countdown

  // Real-time listener for order status changes
  useEffect(() => {
    if (!orderId) return;
    const orderRef = doc(db, 'orders', orderId);

    const unsubscribe = onSnapshot(orderRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setOrder(data);
        setLoading(false);

        if (data.status === 'paid') {
          setIsSuccess(true);
          setTimeout(() => {
            toast.success('Pagamento Pix processado com sucesso! Seus números foram emitidos.', 'Pagamento Aprovado');
          }, 50);
          try {
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.6 }
            });
          } catch (e) {
            // ignore confetti in non-browser environment
          }
          setTimeout(() => navigate(`/comprovante/${orderId}`), 1800);
        } else if (data.status === 'expired') {
          navigate('/');
        }
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [orderId, navigate, toast]);

  // Countdown timer for 15-minute expiration
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

  const handleSimulatePayment = async () => {
    if (!orderId) return;
    setIsSimulating(true);
    try {
      await simulatePixPaymentConfirmation(orderId);
      // The onSnapshot listener will immediately receive the update and transition the UI!
    } catch (err) {
      console.error(err);
      alert('Erro ao confirmar pagamento de teste.');
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

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-neutral-950">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center mb-4 animate-bounce shadow-xl shadow-emerald-500/20">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-black text-white">Pagamento Confirmado!</h2>
        <p className="text-sm text-neutral-400 mt-2 max-w-xs">
          O Mercado Pago confirmou seu Pix com sucesso. Carregando seus bilhetes da sorte...
        </p>
        <div className="mt-6 flex items-center gap-2 text-xs text-emerald-400 font-mono">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Gerando seu comprovante oficial...</span>
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

        {/* Automatic detection notice */}
        <div className="flex items-center justify-center gap-2 text-xs text-neutral-500 pt-1">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
          <span>Identificação automática após o pagamento</span>
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
