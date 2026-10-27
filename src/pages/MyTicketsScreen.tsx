import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { Search, Phone, Ticket, ArrowLeft, Loader2, ExternalLink, Calendar, CheckCircle2, MessageCircle, ShieldCheck, Copy, Check } from 'lucide-react';
import { formatPhone, formatTicketNumber, formatCurrency, cleanPhone, generateWhatsAppTicketMessage, generateWhatsAppLink } from '../utils/raffle';
import { useToast } from '../components/Toast';

export default function MyTicketsScreen() {
  const toast = useToast();
  const [phone, setPhone] = useState<string>('');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searched, setSearched] = useState<boolean>(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value));
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = cleanPhone(phone);
    if (digits.length < 10) return;

    setLoading(true);
    setSearched(true);

    try {
      // Query paid orders with this phone
      const q = query(
        collection(db, 'orders'),
        where('buyer_phone', '==', phone),
        where('status', '==', 'paid')
      );
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      
      // Order by paidAt desc
      docs.sort((a, b) => {
        const timeA = new Date(a.paidAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.paidAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });

      setOrders(docs);
    } catch (err) {
      console.error('Error querying tickets:', err);
    } finally {
      setLoading(false);
    }
  };

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
            Digite o WhatsApp cadastrado na compra para consultar seus números da sorte
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
            Buscar Meus Números
          </button>
        </form>
      </div>

      {/* Results */}
      {searched && !loading && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="p-8 bg-neutral-900 border border-neutral-800 rounded-3xl text-center space-y-2">
              <Ticket className="w-8 h-8 text-neutral-600 mx-auto" />
              <p className="text-xs font-bold text-neutral-300">
                Nenhum número pago encontrado
              </p>
              <p className="text-[11px] text-neutral-500">
                Verifique se o número informado é o mesmo preenchido no checkout ou se o pagamento já foi confirmado.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-neutral-400">
                  {orders.length} pedido(s) encontrado(s)
                </span>
                <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pagamento Confirmado
                </span>
              </div>

              {orders.map((order) => {
                const dateStr = order.paidAt
                  ? new Date(order.paidAt).toLocaleDateString('pt-BR', {
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
                    className="p-5 bg-neutral-900 border border-neutral-800 rounded-3xl shadow-xl space-y-3"
                  >
                    <div className="flex justify-between items-center pb-2.5 border-b border-neutral-800 text-xs">
                      <div>
                        <span className="font-bold text-white block">
                          Pedido #{order.id.slice(-6).toUpperCase()}
                        </span>
                        {dateStr && (
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {dateStr}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => toast.success('Abrindo WhatsApp com seus números!', 'WhatsApp')}
                          className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] font-bold bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-xl transition"
                          title="Salvar bilhetes no WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-current" />
                          <span>WhatsApp</span>
                        </a>

                        <Link
                          className="text-neutral-300 hover:text-white flex items-center gap-1 text-[11px] font-semibold bg-neutral-950 border border-neutral-800 px-2.5 py-1 rounded-xl transition"
                          to={`/comprovante/${order.id}`}
                        >
                          Recibo <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>

                    <div className="flex justify-between text-[11px] font-mono text-neutral-400">
                      <span>Total Pago: R$ {formatCurrency(order.total_amount)}</span>
                      <span>{order.selected_numbers?.length} número(s)</span>
                    </div>

                    {/* Lucky Numbers Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-1 max-h-36 overflow-y-auto pr-1">
                      {order.selected_numbers?.map((n: number) => (
                        <span
                          key={n}
                          className="px-2.5 py-1 bg-neutral-950 border border-neutral-800 hover:border-emerald-500/30 rounded-xl text-emerald-400 font-mono font-bold text-xs shadow-sm"
                        >
                          {formatTicketNumber(n)}
                        </span>
                      ))}
                    </div>

                    {/* Quick WhatsApp Share Button on card */}
                    <div className="pt-2 border-t border-neutral-800/60">
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full py-2 px-3 bg-neutral-950 hover:bg-neutral-800 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-xs font-semibold text-emerald-400 flex items-center justify-center gap-1.5 transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-current" />
                        <span>Salvar estes números no meu WhatsApp</span>
                      </a>
                    </div>
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
