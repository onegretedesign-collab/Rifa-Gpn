import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db, Campaign, Order, simulatePixPaymentConfirmation, resetRifasDemoData, resetAllPurchases, markOrderAsPaid } from '../services/firebaseConfig';
import { DollarSign, Ticket, Layers, Plus, X, ToggleLeft, ToggleRight, Loader2, ArrowLeft, RefreshCw, CheckCircle, Clock, ExternalLink, Image as ImageIcon, Zap, Trash2, Lock, KeyRound, ShieldCheck, Eye, EyeOff, LogOut, User, AlertCircle, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatTicketNumber, generateWhatsAppTicketMessage, generateWhatsAppLink } from '../utils/raffle';
import { useToast } from '../components/Toast';

export default function AdminDashboard() {
  const toast = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('gpn_admin_auth') === 'true' || sessionStorage.getItem('gpn_admin_auth') === 'true';
  });
  const [loginUser, setLoginUser] = useState<string>('');
  const [loginPass, setLoginPass] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string>('');
  const [isSubmittingLogin, setIsSubmittingLogin] = useState<boolean>(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [price, setPrice] = useState<string>('0.50');
  const [totalTickets, setTotalTickets] = useState<string>('1000');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'campaigns' | 'orders'>('campaigns');
  const [orderFilter, setOrderFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmittingLogin(true);

    const cleanUser = loginUser.trim();
    const cleanPass = loginPass.trim();

    // Required credentials: Login: Gpn, Senha: 124578
    if (cleanUser.toLowerCase() === 'gpn' && cleanPass === '124578') {
      localStorage.setItem('gpn_admin_auth', 'true');
      sessionStorage.setItem('gpn_admin_auth', 'true');
      setIsAuthenticated(true);
      setLoginError('');
      toast.success('Acesso liberado com sucesso! Bem-vindo, Gpn.', 'Login Autorizado');
    } else {
      setLoginError('Login ou senha incorretos. Verifique suas credenciais e tente novamente.');
      toast.error('Usuário ou senha incorretos.', 'Acesso Negado');
    }
    setIsSubmittingLogin(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('gpn_admin_auth');
    sessionStorage.removeItem('gpn_admin_auth');
    setIsAuthenticated(false);
    setLoginUser('');
    setLoginPass('');
    toast.info('Você saiu da área administrativa.', 'Sessão Encerrada');
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const unsubCamp = onSnapshot(query(collection(db, 'campaigns'), orderBy('createdAt', 'desc')), (s) => {
      setCampaigns(s.docs.map((d: any) => ({ id: d.id, ...d.data() })));
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (s) => {
      const list = s.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setOrders(list);
      setLoading(false);
    });

    return () => {
      unsubCamp();
      unsubOrders();
    };
  }, [isAuthenticated]);

  const paidOrders = orders.filter(o => o.status === 'paid');
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const totalRevenue = paidOrders.reduce((acc, curr) => acc + Number(curr.total_amount || 0), 0);
  const totalSold = paidOrders.reduce((acc, curr) => acc + (curr.selected_numbers?.length || 0), 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await addDoc(collection(db, 'campaigns'), {
      title: title.trim(),
      description: description.trim() || 'Participe agora deste super sorteio oficial!',
      price_per_ticket: parseFloat(price.replace(',', '.')),
      total_tickets: parseInt(totalTickets, 10) || 1000,
      imageUrl: imageUrl.trim() || 'https://i.postimg.cc/PqCc2GLm/fundo.png',
      status: 'active',
      createdAt: serverTimestamp()
    });

    setIsModalOpen(false);
    setTitle('');
    setDescription('');
    setPrice('0.50');
    setTotalTickets('1000');
    setImageUrl('');
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    await updateDoc(doc(db, 'campaigns', id), {
      status: currentStatus === 'active' ? 'paused' : 'active'
    });
  };

  const handleApproveOrderSimulated = async (orderId: string) => {
    setActionLoadingId(orderId);
    try {
      await simulatePixPaymentConfirmation(orderId);
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const [isSyncingMp, setIsSyncingMp] = useState<boolean>(false);

  const handleSyncMercadoPago = async (silent: boolean = false) => {
    setIsSyncingMp(true);
    try {
      const pendings = orders.filter(o => o.status === 'pending' && (o.pix_payment_id || o.paymentId));
      if (pendings.length === 0) {
        if (!silent) toast.info('Não há pedidos pendentes aguardando baixa no momento.', 'Tudo Atualizado');
        return;
      }

      const checkRes = await fetch('/api/check-pending-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orders: pendings.map(o => ({
            orderId: o.id,
            paymentId: o.pix_payment_id || o.paymentId
          }))
        })
      });

      if (checkRes.ok) {
        const data = await checkRes.json();
        if (data.approved && data.approved.length > 0) {
          for (const app of data.approved) {
            await markOrderAsPaid(app.orderId, app.paymentId, app);
          }
          toast.success(`${data.approved.length} pagamento(s) Pix baixado(s) e confirmados!`, 'Mercado Pago Sincronizado');
        } else if (!silent) {
          toast.info('Nenhum novo pagamento Pix compensado até o momento.', 'Mercado Pago');
        }
      }
    } catch (err) {
      console.error('Error syncing Mercado Pago:', err);
      if (!silent) toast.error('Erro de conexão ao sincronizar com Mercado Pago.');
    } finally {
      setIsSyncingMp(false);
    }
  };

  const handleResetPurchases = () => {
    if (window.confirm('Tem certeza que deseja zerar todas as compras e liberar todos os 300 números?')) {
      resetAllPurchases();
    }
  };

  // If not authenticated, require Admin credentials
  if (!isAuthenticated) {
    return (
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500" />

            {/* Header Icon & Title */}
            <div className="text-center mb-6">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-emerald-500/20 to-neutral-900 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10 mb-3">
                <ShieldCheck className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">Área Restrita ADMIN</h2>
              <p className="text-xs text-neutral-400 mt-1">
                Painel de controle e faturamento do Grupo Part Negra
              </p>
            </div>

            {/* Error Message */}
            {loginError && (
              <div className="mb-4 p-3 bg-red-950/60 border border-red-500/40 rounded-xl flex items-center gap-2.5 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
                  Login / Usuário
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="Digite o login (Gpn)"
                    value={loginUser}
                    onChange={(e) => {
                      setLoginUser(e.target.value);
                      if (loginError) setLoginError('');
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-xl pl-10 pr-3.5 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none transition shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="Digite a senha (124578)"
                    value={loginPass}
                    onChange={(e) => {
                      setLoginPass(e.target.value);
                      if (loginError) setLoginError('');
                    }}
                    className="w-full bg-neutral-950 border border-neutral-800 focus:border-emerald-500 rounded-xl pl-10 pr-11 py-3 text-sm text-white placeholder-neutral-600 focus:outline-none transition font-mono shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-500 hover:text-neutral-300 transition cursor-pointer"
                    aria-label={showPassword ? 'Ocultar senha' : 'Exibir senha'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmittingLogin}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 text-neutral-950 font-black text-sm rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 mt-2"
              >
                {isSubmittingLogin ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <KeyRound className="w-4 h-4 stroke-[2.5]" />
                    <span>Entrar no Painel</span>
                  </>
                )}
              </button>
            </form>

            {/* Back link */}
            <div className="mt-6 pt-4 border-t border-neutral-800/80 text-center">
              <Link
                to="/"
                className="text-xs text-neutral-400 hover:text-white inline-flex items-center gap-1.5 transition"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar para a Loja de Rifas
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  const filteredOrders = orders.filter(o => {
    if (orderFilter === 'paid') return o.status === 'paid';
    if (orderFilter === 'pending') return o.status === 'pending';
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/" className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 transition">
              <ArrowLeft className="w-3.5 h-3.5" /> Voltar à Loja
            </Link>
            <span className="text-neutral-600">•</span>
            <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sessão Ativa: Gpn
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">Painel Administrativo Rifas GPN</h1>
          <p className="text-xs text-neutral-400">Visão financeira em tempo real, gestão de cotas e campanhas</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isSyncingMp}
            onClick={() => handleSyncMercadoPago(false)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 rounded-xl text-emerald-400 hover:text-emerald-300 text-xs font-bold transition cursor-pointer"
            title="Sincronizar pagamentos Pix com a API do Mercado Pago"
          >
            {isSyncingMp ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>Sincronizar MP</span>
          </button>
          <button
            type="button"
            onClick={handleResetPurchases}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 rounded-xl text-red-400 hover:text-red-300 text-xs font-semibold transition cursor-pointer"
            title="Zerar todas as compras e liberar os 300 números"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Zerar Compras</span>
          </button>
          <button
            type="button"
            onClick={() => resetRifasDemoData()}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-400 hover:text-white text-xs transition cursor-pointer"
            title="Restaurar dados de teste"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Restaurar</span>
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" /> Nova Rifa
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-400 hover:text-red-400 text-xs font-semibold transition cursor-pointer"
            title="Encerrar sessão de administrador"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block">
            Faturamento Realizado
          </span>
          <p className="text-2xl sm:text-3xl font-black font-mono text-emerald-400 mt-1">
            R$ {formatCurrency(totalRevenue)}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1 font-mono">
            {paidOrders.length} pedido(s) faturado(s)
          </p>
        </div>

        <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block">
            Números Pagos / Vendidos
          </span>
          <p className="text-2xl sm:text-3xl font-black font-mono text-white mt-1">
            {totalSold.toLocaleString('pt-BR')} / 300
          </p>
          <p className="text-[11px] text-neutral-500 mt-1 font-mono">
            Baixa atômica no banco de dados
          </p>
        </div>

        <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-xl">
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block">
            Aguardando Pix
          </span>
          <p className="text-2xl sm:text-3xl font-black font-mono text-amber-400 mt-1">
            {pendingOrders.length}
          </p>
          <p className="text-[11px] text-neutral-500 mt-1 font-mono">
            Expiração em 15 minutos (Cron)
          </p>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-neutral-800 text-xs font-bold gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('campaigns')}
          className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'campaigns'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          <Ticket className="w-4 h-4" />
          Campanhas Cadastradas ({campaigns.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`pb-3 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'orders'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-neutral-400 hover:text-white'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Fluxo de Pedidos ({orders.length})
        </button>
      </div>

      {/* Tab: Campanhas */}
      {activeTab === 'campaigns' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-neutral-800 text-xs font-bold uppercase tracking-wider text-neutral-400 flex justify-between items-center">
            <span>Rifas Ativas e Pausadas</span>
            <span className="text-[10px] text-neutral-500 font-mono">Status em tempo real</span>
          </div>

          <div className="divide-y divide-neutral-800">
            {campaigns.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                Nenhuma campanha cadastrada. Clique em "Nova Rifa" para começar.
              </div>
            ) : (
              campaigns.map((camp) => (
                <div key={camp.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-neutral-800/40 transition">
                  <div className="flex items-center gap-3">
                    <img
                      src={camp.imageUrl}
                      alt={camp.title}
                      className="w-14 h-14 rounded-xl object-cover bg-neutral-950 flex-shrink-0 border border-neutral-800"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm text-white">{camp.title}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          camp.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}>
                          {camp.status === 'active' ? 'Ativa' : 'Pausada'}
                        </span>
                      </div>
                      <p className="text-neutral-400 text-[11px] mt-0.5 line-clamp-1">{camp.description}</p>
                      <p className="text-neutral-500 font-mono text-[11px] mt-1">
                        Cota: <strong className="text-emerald-400">R$ {formatCurrency(camp.price_per_ticket)}</strong> | Total Cotas: {camp.total_tickets.toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    <span className="text-[11px] text-neutral-400">
                      {camp.status === 'active' ? 'Publicada' : 'Oculta'}
                    </span>
                    <button
                      type="button"
                      onClick={() => toggleStatus(camp.id, camp.status)}
                      className="p-1 hover:opacity-80 transition cursor-pointer"
                      title={camp.status === 'active' ? 'Pausar rifa' : 'Ativar rifa'}
                    >
                      {camp.status === 'active' ? (
                        <ToggleRight className="w-7 h-7 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-7 h-7 text-neutral-500" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Pedidos */}
      {activeTab === 'orders' && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden shadow-xl space-y-3">
          <div className="p-4 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">
              Histórico de Vendas Pix
            </span>

            {/* Actions & Filter buttons */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isSyncingMp}
                onClick={() => handleSyncMercadoPago(false)}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-400 font-bold text-xs flex items-center gap-1 transition cursor-pointer"
                title="Sincronizar pagamentos pendentes com a API do Mercado Pago"
              >
                {isSyncingMp ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                <span>Sincronizar Vendas MP</span>
              </button>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={() => setOrderFilter('all')}
                  className={`px-2.5 py-1 rounded-lg ${orderFilter === 'all' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-500 hover:text-neutral-300'}`}
                >
                  Todos ({orders.length})
                </button>
              <button
                type="button"
                onClick={() => setOrderFilter('paid')}
                className={`px-2.5 py-1 rounded-lg ${orderFilter === 'paid' ? 'bg-emerald-500/20 text-emerald-400 font-bold' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                Pagos ({paidOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setOrderFilter('pending')}
                className={`px-2.5 py-1 rounded-lg ${orderFilter === 'pending' ? 'bg-amber-500/20 text-amber-400 font-bold' : 'text-neutral-500 hover:text-neutral-300'}`}
              >
                Pendentes ({pendingOrders.length})
              </button>
            </div>
          </div>
        </div>

          <div className="divide-y divide-neutral-800 max-h-[500px] overflow-y-auto">
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-500">
                Nenhum pedido com este filtro.
              </div>
            ) : (
              filteredOrders.map((ord) => (
                <div key={ord.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-neutral-800/30 transition">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-white">#{ord.id.slice(-6).toUpperCase()}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                        ord.status === 'paid'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : ord.status === 'expired'
                          ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {ord.status === 'paid' ? 'Pago' : ord.status === 'expired' ? 'Expirado' : 'Aguardando Pix'}
                      </span>
                    </div>

                    <div className="mt-1 text-neutral-400 text-[11px]">
                      <span>{ord.buyer_name}</span> • <span>{ord.buyer_phone}</span>
                    </div>

                    <div className="mt-1 font-mono text-[11px] text-neutral-400">
                      Valor: <strong className="text-white">R$ {formatCurrency(ord.total_amount)}</strong> • Cotas ({ord.selected_numbers?.length}):{' '}
                      <span className="text-emerald-400">
                        {ord.selected_numbers?.slice(0, 5).map(n => formatTicketNumber(n)).join(', ')}
                        {(ord.selected_numbers?.length || 0) > 5 ? ' ...' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-center">
                    {ord.status === 'pending' && (
                      <button
                        type="button"
                        disabled={actionLoadingId === ord.id}
                        onClick={() => handleApproveOrderSimulated(ord.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-[11px] font-bold transition cursor-pointer"
                        title="Simular Webhook Pix do Mercado Pago"
                      >
                        {actionLoadingId === ord.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Zap className="w-3 h-3" />
                        )}
                        Simular Baixa
                      </button>
                    )}

                    {ord.status === 'paid' && (
                      <div className="flex items-center gap-1.5">
                        <a
                          href={generateWhatsAppLink(
                            ord.buyer_phone,
                            generateWhatsAppTicketMessage({
                              buyerName: ord.buyer_name,
                              buyerPhone: ord.buyer_phone,
                              orderId: ord.id,
                              selectedNumbers: ord.selected_numbers || [],
                              totalAmount: ord.total_amount,
                              totalTickets: 300
                            })
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:text-emerald-300 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-xl transition"
                          title="Enviar bilhetes no WhatsApp do comprador"
                        >
                          <MessageCircle className="w-3 h-3 fill-current" />
                          <span>WhatsApp</span>
                        </a>

                        <Link
                          to={`/comprovante/${ord.id}`}
                          className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white px-2.5 py-1 bg-neutral-950 border border-neutral-800 rounded-xl transition"
                        >
                          Recibo <ExternalLink className="w-3 h-3 text-emerald-400" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal Criar Nova Rifa */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-400" />
                Criar Nova Campanha de Rifa
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:text-white text-neutral-400 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                  Título do Prêmio
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: PlayStation 5 Slim 1TB + 2 Jogos"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                  Descrição Curta
                </label>
                <input
                  type="text"
                  placeholder="Ex: Console novo na caixa lacrada com garantia oficial"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Valor por Cota (R$)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0.50"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                    Total de Cotas
                  </label>
                  <input
                    type="number"
                    required
                    min="10"
                    placeholder="1000"
                    value={totalTickets}
                    onChange={(e) => setTotalTickets(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-neutral-400 block mb-1">
                  URL da Foto do Prêmio
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl p-3 text-xs text-white font-mono focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setImageUrl('https://images.unsplash.com/photo-1606813907291-d86efa9b94db?auto=format&fit=crop&w=800&q=80')}
                    className="text-[10px] bg-neutral-950 border border-neutral-800 px-2 py-1 rounded-lg text-neutral-400 hover:text-white"
                  >
                    Ex: PS5
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUrl('https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=800&q=80')}
                    className="text-[10px] bg-neutral-950 border border-neutral-800 px-2 py-1 rounded-lg text-neutral-400 hover:text-white"
                  >
                    Ex: iPhone
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageUrl('https://images.unsplash.com/photo-1558981403-c5f9899a28bc?auto=format&fit=crop&w=800&q=80')}
                    className="text-[10px] bg-neutral-950 border border-neutral-800 px-2 py-1 rounded-lg text-neutral-400 hover:text-white"
                  >
                    Ex: Moto
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs shadow-lg shadow-emerald-500/20 transition cursor-pointer"
                >
                  Salvar e Publicar Rifa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
