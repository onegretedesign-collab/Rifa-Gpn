import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db, markOrderAsPaid } from '../services/firebaseConfig';
import { Search, Phone, Ticket, ArrowLeft, Loader2, ExternalLink, Calendar, CheckCircle2, MessageCircle, ShieldCheck, Copy, Check, RefreshCw, Clock, FileDown } from 'lucide-react';
import { formatPhone, formatTicketNumber, formatCurrency, cleanPhone, generateWhatsAppTicketMessage, generateWhatsAppLink } from '../utils/raffle';
import { downloadReceiptPdf } from '../utils/pdfReceipt';
import { useToast } from '../components/Toast';

export default function MyTicketsScreen() {
  const toast = useToast();
  const [phone, setPhone] = useState<string>('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searched, setSearched] = useState<boolean>(false);
  const [verifyingOrderId, setVerifyingOrderId] = useState<string | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const digits = cleanPhone(phone);
    if (digits.length < 10) {
      toast.info('Por favor, informe seu WhatsApp com DDD.', 'Número Incompleto');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      // 1. Query all orders for this phone (both paid and pending)
      const q = query(
        collection(db, 'orders'),
        where('buyer_phone', '==', phone)
      );
      const snap = await getDocs(q);
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // 2. Identify pending orders that have Mercado Pago payment IDs
      const pendingToCheck = docs.filter(
        d => d.status === 'pending' && (d.pix_payment_id || d.paymentId)
      );

      if (pendingToCheck.length > 0) {
        try {
          const checkRes = await fetch('/api/check-pending-orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orders: pendingToCheck.map(o => ({
                orderId: o.id,
                paymentId: o.pix_payment_id || o.paymentId
              }))
            })
          });

          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.approved && checkData.approved.length > 0) {
              for (const approved of checkData.approved) {
                await markOrderAsPaid(approved.orderId, approved.paymentId, approved);
              }
              toast.success(
                `${checkData.approved.length} pagamento(s) Pix identificado(s) e aprovado(s)!`,
                'Mercado Pago Sincronizado'
              );

              // Re-fetch after marking as paid
              const freshSnap = await getDocs(q);
              docs = freshSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            }
          }
        } catch (syncErr) {
          console.warn('Silent sync error:', syncErr);
        }
      }

      // 3. Sort paid orders first, then by date descending
      docs.sort((a, b) => {
        if (a.status === 'paid' && b.status !== 'paid') return -1;
        if (a.status !== 'paid' && b.status === 'paid') return 1;
        const timeA = new Date(a.paidAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.paidAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      setOrders(docs);
    } catch (err) {
      console.error('Error querying tickets:', err);
      toast.error('Erro ao buscar pedidos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualCheckOrder = async (order: any) => {
    const paymentId = order.pix_payment_id || order.paymentId;
    if (!paymentId) return;

    setVerifyingOrderId(order.id);
    try {
      const res = await fetch(`/api/pix-status/${paymentId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.is_approved || data.payment_status === 'approved') {
          await markOrderAsPaid(order.id, String(paymentId), data.raw);
          toast.success('Pagamento confirmado com sucesso!', 'Pix Aprovado');
          // Refresh list
          await handleSearch();
        } else {
          toast.info(
            `Status no Mercado Pago: ${data.payment_status || 'Pendente'}. Conclua o Pix no seu app do banco para aprovação.`,
            'Aguardando Liquidação'
          );
        }
      } else {
        toast.error('Não foi possível verificar status com o banco.');
      }
    } catch (err) {
      toast.error('Falha de conexão ao verificar pagamento.');
    } finally {
      setVerifyingOrderId(null);
    }
  };

  const paidOrders = orders.filter(o => o.status === 'paid');
  const pendingOrders = orders.filter(o => o.status === 'pending');

  return (
    <div className="max-w-md mx-auto p-4 pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <Link
          className="text-xs text-neutral-400 hover:text-white flex items-center gap-1.5 transition"
          to="/"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Início
        </Link>
        <span className="text-xs font-bold text-neutral-500 font-mono">
          Rifas GPN
        </span>
      </div>

      {/* Search Box */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 mb-5 shadow-2xl space-y-4">
        <div>
          <h1 className="text-base font-black text-white">Consultar Meus Bilhetes</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Digite o WhatsApp cadastrado na compra para consultar seus números da sorte e verificar pagamentos Pix
          </p>
        </div>

        <form onSubmit={handleSearch} className="space-y-3">
          <div className="relative">
            <input
              type="tel"
              required
              placeholder="(00) 00000-0000"
              value={phone}
              onChange={handlePhoneChange}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl py-3.5 px-4 pl-10 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono transition"
            />
            <Phone className="w-4 h-4 text-neutral-500 absolute left-3.5 top-3.5" />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-2xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4 stroke-[2.5]" />
            )}
            Buscar Meus Números & Atualizar Pix
          </button>
        </form>
      </div>

      {/* Results */}
      {searched && !loading && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-3xl text-center space-y-2">
              <Ticket className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-xs font-bold text-neutral-300">
                Nenhum pedido encontrado para este telefone
              </p>
              <p className="text-[11px] text-neutral-500">
                Verifique se o número informado é o mesmo preenchido no checkout ({phone}).
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-neutral-400">
                  {paidOrders.length} compra(s) confirmada(s)
                  {pendingOrders.length > 0 ? ` • ${pendingOrders.length} aguardando Pix` : ''}
                </span>
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Sincronizado
                </span>
              </div>

              {orders.map((order) => {
                const isPaid = order.status === 'paid';
                const dateStr = order.paidAt || order.createdAt
                  ? new Date(order.paidAt || order.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : '';

                const msg = generateWhatsAppTicketMessage({
                  buyerName: order.buyer_name || 'Participante',
                  buyerPhone: order.buyer_phone,
                  orderId: order.id,
                  selectedNumbers: order.selected_numbers || [],
                  totalAmount: order.total_amount,
                  totalTickets: 300
                });
                const waUrl = generateWhatsAppLink(order.buyer_phone || phone, msg);

                return (
                  <div
                    key={order.id}
                    className={`p-5 bg-neutral-900 border rounded-3xl shadow-xl space-y-3 ${
                      isPaid ? 'border-neutral-800' : 'border-amber-500/30'
                    }`}
                  >
                    <div className="flex justify-between items-center pb-2.5 border-b border-neutral-800 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white block">
                            Pedido #{order.id.slice(-6).toUpperCase()}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isPaid
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            }`}
                          >
                            {isPaid ? 'Pago & Confirmado' : 'Aguardando Pagamento'}
                          </span>
                        </div>
                        {dateStr && (
                          <span className="text-[10px] text-neutral-500 font-mono mt-0.5 block">
                            {dateStr}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isPaid ? (
                          <>
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => toast.success('Abrindo WhatsApp com seus números!', 'WhatsApp')}
                              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-xl transition cursor-pointer"
                              title="Salvar bilhetes no WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5 fill-current" />
                              <span>WhatsApp</span>
                            </a>

                            <button
                              type="button"
                              onClick={() => {
                                downloadReceiptPdf(order);
                                toast.success('Comprovante em PDF baixado!', 'PDF Oficial');
                              }}
                              className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] font-bold bg-neutral-950 border border-emerald-500/30 px-2 py-1 rounded-xl transition cursor-pointer"
                              title="Baixar comprovante em PDF"
                            >
                              <FileDown className="w-3 h-3 text-emerald-400" />
                              <span>PDF</span>
                            </button>

                            <Link
                              className="text-neutral-300 hover:text-white flex items-center gap-1 text-[11px] font-semibold bg-neutral-950 border border-neutral-800 px-2.5 py-1 rounded-xl transition"
                              to={`/comprovante/${order.id}`}
                            >
                              Recibo <ExternalLink className="w-3 h-3" />
                            </Link>
                          </>
                        ) : (
                          <Link
                            to={`/pagamento/${order.id}`}
                            className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] font-bold bg-amber-500/15 border border-amber-500/30 px-2.5 py-1 rounded-xl transition"
                          >
                            <Clock className="w-3 h-3" />
                            <span>Pagar Pix</span>
                          </Link>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                      <span>Valor: R$ {formatCurrency(order.total_amount)}</span>
                      <span>{order.selected_numbers?.length} número(s)</span>
                    </div>

                    {/* Lucky Numbers Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1 max-h-36 overflow-y-auto pr-1">
                      {order.selected_numbers?.map((n: number) => (
                        <span
                          key={n}
                          className={`px-2.5 py-1 rounded-xl font-mono font-bold text-xs shadow-sm ${
                            isPaid
                              ? 'bg-neutral-950 border border-emerald-500/30 text-emerald-400'
                              : 'bg-neutral-950 border border-neutral-800 text-neutral-400'
                          }`}
                        >
                          {formatTicketNumber(n)}
                        </span>
                      ))}
                    </div>

                    {/* Pending Order Verification Button */}
                    {!isPaid && (
                      <div className="pt-2 border-t border-neutral-800 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-amber-400">
                          Transferiu no banco? Verifique agora:
                        </span>
                        <button
                          type="button"
                          disabled={verifyingOrderId === order.id}
                          onClick={() => handleManualCheckOrder(order)}
                          className="px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                        >
                          {verifyingOrderId === order.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          <span>Verificar Pix</span>
                        </button>
                      </div>
                    )}

                    {/* Quick WhatsApp & PDF Buttons on card */}
                    {isPaid && (
                      <div className="pt-2 border-t border-neutral-800/60 flex flex-col sm:flex-row gap-2">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 px-3 bg-neutral-950 hover:bg-neutral-800 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5 transition"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-current" />
                          <span>Salvar no WhatsApp</span>
                        </a>
                        <button
                          type="button"
                          onClick={() => {
                            downloadReceiptPdf(order);
                            toast.success('Comprovante em PDF baixado com sucesso!', 'PDF Oficial');
                          }}
                          className="py-2 px-3 bg-neutral-950 hover:bg-neutral-800 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                        >
                          <FileDown className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Baixar PDF</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Informative footer card */}
              <div className="p-4 rounded-2xl bg-neutral-950 border border-emerald-500/20 text-xs text-neutral-300 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>Informações Oficiais do Sorteio</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-neutral-400 leading-relaxed font-sans">
                  <p>• <strong>Data do Sorteio:</strong> O sorteio oficial será realizado após a compra e encerramento de todos os 300 números.</p>
                  <p>• <strong>Guarde seus Números:</strong> Guarde seus números para conferência oficial no dia da apuração.</p>
                  <p>• <strong>Transmissão Ao Vivo:</strong> Você será avisado no WhatsApp sobre o dia e horário do sorteio ao vivo!</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
