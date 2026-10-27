import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { CheckCircle2, Ticket, Printer, Share2, ArrowLeft, Loader2, Calendar, Phone, User, DollarSign, ShieldCheck, MessageCircle, Copy, Check, Radio, CreditCard, Mail, FileDown } from 'lucide-react';
import { formatCurrency, formatTicketNumber, generateWhatsAppTicketMessage, generateWhatsAppLink, formatCpf } from '../utils/raffle';
import { downloadReceiptPdf } from '../utils/pdfReceipt';
import confetti from 'canvas-confetti';
import { useToast } from '../components/Toast';

export default function ReceiptScreen() {
  const { orderId } = useParams();
  const toast = useToast();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copiedShare, setCopiedShare] = useState<boolean>(false);
  const [copiedMessage, setCopiedMessage] = useState<boolean>(false);
  const [whatsappSent, setWhatsappSent] = useState<boolean>(false);

  useEffect(() => {
    async function loadReceipt() {
      if (!orderId) return;
      try {
        const snap = await getDoc(doc(db, 'orders', orderId));
        if (snap.exists()) {
          setOrder({ id: snap.id, ...snap.data() });
          try {
            confetti({
              particleCount: 50,
              spread: 60,
              origin: { y: 0.5 }
            });
          } catch (e) {
            // ignore
          }
        }
      } catch (err) {
        console.error('Error fetching receipt:', err);
      } finally {
        setLoading(false);
      }
    }
    loadReceipt();
  }, [orderId]);

  const handleShare = () => {
    const text = `Meus números da sorte no Rifas GPN! Pedido #${orderId?.slice(-6).toUpperCase()} - Boa sorte pra mim! 🍀`;
    if (navigator.share) {
      navigator.share({
        title: 'Meus Bilhetes - Rifas GPN',
        text,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      setCopiedShare(true);
      setTimeout(() => setCopiedShare(false), 2500);
    }
  };

  const whatsappMessage = order ? generateWhatsAppTicketMessage({
    buyerName: order.buyer_name,
    buyerPhone: order.buyer_phone,
    orderId: order.id,
    selectedNumbers: order.selected_numbers || [],
    totalAmount: order.total_amount,
    totalTickets: 300,
  }) : '';

  const whatsappLink = order ? generateWhatsAppLink(order.buyer_phone, whatsappMessage) : '#';

  const handleSendWhatsApp = () => {
    if (!order) return;
    setWhatsappSent(true);
    window.open(whatsappLink, '_blank', 'noopener,noreferrer');
    toast.success('Abrindo WhatsApp para enviar e guardar seus números!', 'Enviado para WhatsApp');
  };

  const fallbackCopy = (text: string) => {
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.left = '-999999px';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      el.remove();
      setCopiedMessage(true);
      toast.success('Mensagem com seus números copiada com sucesso!', 'Copiado');
      setTimeout(() => setCopiedMessage(false), 2500);
    } catch {
      toast.info('Selecione e copie o texto manualmente.', 'Copiar');
    }
  };

  const handleCopyMessage = () => {
    if (!whatsappMessage) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(whatsappMessage)
          .then(() => {
            setCopiedMessage(true);
            toast.success('Mensagem com seus números copiada com sucesso!', 'Copiado');
            setTimeout(() => setCopiedMessage(false), 2500);
          })
          .catch(() => fallbackCopy(whatsappMessage));
      } else {
        fallbackCopy(whatsappMessage);
      }
    } catch {
      fallbackCopy(whatsappMessage);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 max-w-sm">
          <p className="text-sm text-neutral-400 mb-4">Pedido não encontrado ou expirado.</p>
          <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500 text-neutral-950 font-bold rounded-xl text-xs">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Início
          </Link>
        </div>
      </div>
    );
  }

  const formattedDate = order.paidAt
    ? new Date(order.paidAt).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString('pt-BR');

  return (
    <div className="min-h-screen p-4 pb-12 flex flex-col items-center print:bg-white print:p-0 print:text-black">
      {/* Action buttons (hidden on print) */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 print:hidden">
        <Link
          className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition"
          to="/"
        >
          <ArrowLeft className="w-4 h-4" /> Início
        </Link>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              downloadReceiptPdf(order);
              toast.success('Comprovante em PDF baixado!', 'PDF');
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-400 transition cursor-pointer"
            title="Baixar comprovante oficial em PDF"
          >
            <FileDown className="w-3.5 h-3.5 text-emerald-400" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-300 transition cursor-pointer"
            title="Imprimir ou Salvar em PDF"
          >
            <Printer className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Imprimir</span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-xs font-semibold text-neutral-300 transition cursor-pointer"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{copiedShare ? 'Copiado!' : 'Compartilhar'}</span>
          </button>
        </div>
      </div>

      {/* Official Receipt Card */}
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl print:border-neutral-300 print:bg-white print:text-black print:shadow-none space-y-0">
        {/* Card Header */}
        <div className="p-6 text-center border-b border-neutral-800 bg-gradient-to-b from-emerald-950/20 to-transparent print:border-neutral-300 print:bg-none">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-2.5 shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            Pagamento Aprovado
          </span>
          <h1 className="text-xl font-black text-white mt-2 print:text-black">
            Compra Confirmada!
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5 font-mono print:text-neutral-600">
            Pedido #{order.id.slice(-6).toUpperCase()}
          </p>
        </div>

        {/* WhatsApp Delivery Action Banner */}
        <div className="p-4 bg-gradient-to-br from-emerald-950/40 via-neutral-950 to-neutral-900 border-b border-emerald-500/20 print:hidden">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-neutral-950 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
              <MessageCircle className="w-5 h-5 fill-current" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-black text-white">Receber no WhatsApp</h3>
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  RECOMENDADO
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 leading-relaxed">
                Envie seus números para o seu WhatsApp ({order.buyer_phone}) para guardar e receber o aviso do sorteio ao vivo!
              </p>

              <div className="mt-3 flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="flex-1 py-2.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition active:scale-[0.98] cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4 fill-current" />
                    <span>{whatsappSent ? 'Reenviar no WhatsApp' : 'Salvar Números no WhatsApp'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyMessage}
                    className="py-2.5 px-3 bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-[11px] font-semibold text-neutral-300 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    title="Copiar texto da mensagem"
                  >
                    {copiedMessage ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-neutral-400" />}
                    <span>{copiedMessage ? 'Copiado!' : 'Copiar Texto'}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    downloadReceiptPdf(order);
                    toast.success('Comprovante em PDF baixado com sucesso! Agora você pode anexar no WhatsApp.', 'PDF Oficial');
                  }}
                  className="w-full py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 border border-emerald-500/30 hover:border-emerald-500/60 text-emerald-300 hover:text-emerald-200 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-md cursor-pointer active:scale-[0.99]"
                >
                  <FileDown className="w-4 h-4 text-emerald-400" />
                  <span>Baixar Comprovante em PDF (Para Enviar no WhatsApp)</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Details Table */}
        <div className="p-5 text-xs space-y-2.5 border-b border-neutral-800 font-mono print:border-neutral-300">
          <div className="flex justify-between items-center">
            <span className="text-neutral-400 font-sans flex items-center gap-1.5 print:text-neutral-600">
              <User className="w-3.5 h-3.5 text-neutral-500" />
              Comprador:
            </span>
            <span className="font-bold text-white print:text-black">{order.buyer_name}</span>
          </div>

          {order.buyer_cpf && (
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-sans flex items-center gap-1.5 print:text-neutral-600">
                <CreditCard className="w-3.5 h-3.5 text-neutral-500" />
                CPF:
              </span>
              <span className="text-neutral-300 print:text-black">{formatCpf(order.buyer_cpf)}</span>
            </div>
          )}

          {order.buyer_email && (
            <div className="flex justify-between items-center">
              <span className="text-neutral-400 font-sans flex items-center gap-1.5 print:text-neutral-600">
                <Mail className="w-3.5 h-3.5 text-neutral-500" />
                E-mail:
              </span>
              <span className="text-neutral-300 print:text-black truncate max-w-[200px]">{order.buyer_email}</span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-neutral-400 font-sans flex items-center gap-1.5 print:text-neutral-600">
              <Phone className="w-3.5 h-3.5 text-neutral-500" />
              WhatsApp:
            </span>
            <span className="text-neutral-200 print:text-black">{order.buyer_phone}</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-neutral-400 font-sans flex items-center gap-1.5 print:text-neutral-600">
              <Calendar className="w-3.5 h-3.5 text-neutral-500" />
              Data/Hora:
            </span>
            <span className="text-neutral-400 print:text-neutral-600">{formattedDate}</span>
          </div>

          <div className="flex justify-between items-center pt-2 border-t border-neutral-800/80 print:border-neutral-200">
            <span className="text-neutral-400 font-sans font-bold flex items-center gap-1.5 print:text-neutral-600">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Total Pago (Pix):
            </span>
            <span className="text-emerald-400 font-extrabold text-sm print:text-black">
              R$ {formatCurrency(order.total_amount)}
            </span>
          </div>
        </div>

        {/* Lucky Numbers List */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-neutral-200 flex items-center gap-1.5 print:text-black">
              <Ticket className="w-4 h-4 text-emerald-400" />
              Seus Números da Sorte ({order.selected_numbers?.length}):
            </p>
            <span className="text-[10px] text-neutral-500 font-mono">
              Loteria Federal
            </span>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-60 overflow-y-auto pr-1">
            {order.selected_numbers?.map((n: number) => (
              <div
                key={n}
                className="py-2.5 px-1 text-center font-mono font-bold text-xs bg-neutral-950 border border-neutral-800 text-emerald-400 rounded-xl select-all shadow-sm hover:border-emerald-500/40 transition print:bg-neutral-100 print:border-neutral-300 print:text-black"
              >
                {formatTicketNumber(n)}
              </div>
            ))}
          </div>

          {/* Sorteio & WhatsApp Rules and Live Notification Notice */}
          <div className="mt-5 p-4 rounded-2xl bg-neutral-950 border border-emerald-500/20 text-xs text-neutral-300 space-y-2.5 print:bg-white print:border-neutral-200 print:text-black">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs pb-1 border-b border-neutral-800/80">
              <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>Regulamento & Informações Oficiais</span>
            </div>

            <div className="space-y-2 text-[11px] text-neutral-400 leading-relaxed font-sans">
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">1.</span>
                <span><strong>Final da compra de todos os números:</strong> O sorteio oficial será realizado após o encerramento da compra de todos os 300 números da rifa.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">2.</span>
                <span><strong>Guarde para conferência:</strong> Guarde estes números para conferência oficial no dia da apuração do sorteio.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">3.</span>
                <span><strong>Aviso no WhatsApp do sorteio ao vivo:</strong> Você será avisado no seu WhatsApp com o dia e horário da transmissão ao vivo do sorteio!</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
