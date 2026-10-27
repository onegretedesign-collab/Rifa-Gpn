import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, addDoc, serverTimestamp, onSnapshot, doc } from 'firebase/firestore';
import { db, Campaign, simulatePixPaymentConfirmation } from '../services/firebaseConfig';
import { Ticket as TicketIcon, Sparkles, Search, ShieldCheck, Loader2, Grid, Zap, Calendar, Music, TrendingUp, AlertCircle, CheckCircle2, Share2, MessageCircle, Copy, Check, X, Mail, CreditCard } from 'lucide-react';
import { formatCurrency, formatPhone, formatTicketNumber, generateRaffleTickets, generatePixCode, calculateProgress, formatCpf, cleanCpf, validateEmail, validateCpf } from '../utils/raffle';
import TicketGrid from '../components/TicketGrid';
import { useToast } from '../components/Toast';
import PixPaymentModal, { PixData } from '../components/PixPaymentModal';
import { gerarCobrancaPixMercadoPago } from '../services/mercadoPagoService';

export default function Home() {
  const navigate = useNavigate();
  const toast = useToast();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [ticketsCount, setTicketsCount] = useState<number>(1);
  const [manualSelectedNumbers, setManualSelectedNumbers] = useState<number[]>([]);
  const [buyerName, setBuyerName] = useState<string>('');
  const [buyerPhone, setBuyerPhone] = useState<string>('');
  const [buyerCpf, setBuyerCpf] = useState<string>('');
  const [buyerEmail, setBuyerEmail] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Pix Modal Mercado Pago state
  const [isPixModalOpen, setIsPixModalOpen] = useState<boolean>(false);
  const [modalPixData, setModalPixData] = useState<PixData | null>(null);
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  // Share modal & copy state
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  
  // Real-time sets for occupied and paid numbers
  const [unavailableNumbers, setUnavailableNumbers] = useState<Set<number>>(new Set());
  const [paidNumbersCount, setPaidNumbersCount] = useState<number>(0);

  // Listen to the single active campaign
  useEffect(() => {
    const q = query(collection(db, 'campaigns'), where('status', '==', 'active'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Campaign[] = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      if (list.length > 0) {
        setCampaign(list[0]);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Listen to tickets and orders in real-time so placed/fulfilled numbers are NEVER available again
  useEffect(() => {
    if (!campaign) return;

    // Listen to all tickets for this campaign
    const qTickets = query(
      collection(db, 'tickets'),
      where('campaign_id', '==', campaign.id)
    );

    const unsubTickets = onSnapshot(qTickets, (snap) => {
      const taken = new Set<number>();
      let paidCount = 0;

      snap.docs.forEach((docSnap: any) => {
        const data = docSnap.data();
        if (data && typeof data.number === 'number') {
          // Numbers with status 'paid' or 'reserved' are no longer available
          if (data.status === 'paid' || data.status === 'reserved') {
            taken.add(data.number);
          }
          if (data.status === 'paid') {
            paidCount++;
          }
        }
      });

      setUnavailableNumbers(taken);
      setPaidNumbersCount(paidCount);
    });

    // Also listen to orders as backup to ensure any pending/paid order numbers are strictly locked
    const qOrders = query(
      collection(db, 'orders'),
      where('campaign_id', '==', campaign.id)
    );

    const unsubOrders = onSnapshot(qOrders, (snap) => {
      setUnavailableNumbers(prev => {
        const next = new Set(prev);
        snap.docs.forEach((d: any) => {
          const ord = d.data();
          if (ord.status === 'paid' || ord.status === 'pending') {
            if (Array.isArray(ord.selected_numbers)) {
              ord.selected_numbers.forEach((n: number) => next.add(n));
            }
          }
        });
        return next;
      });
    });

    return () => {
      unsubTickets();
      unsubOrders();
    };
  }, [campaign?.id]);

  const totalTickets = campaign?.total_tickets || 300;
  const pricePerTicket = Number(campaign?.price_per_ticket || 50.00);

  // Progress of funds and remaining numbers
  const progress = useMemo(() => {
    // Number of taken/fulfilled numbers
    const sold = Math.max(paidNumbersCount, unavailableNumbers.size);
    return calculateProgress(sold, totalTickets, pricePerTicket);
  }, [paidNumbersCount, unavailableNumbers.size, totalTickets, pricePerTicket]);

  const remainingAvailable = Math.max(0, totalTickets - unavailableNumbers.size);
  const isSoldOut = remainingAvailable === 0;

  // Share functionality
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = campaign?.title || 'Show Completo do Grupo Part Negra - Rifa Oficial';
  const shareMessage = `*${shareTitle}!* 🎶\nQue tal ter um show completo do Grupo Part Negra para seu evento ou confraternização por apenas R$ 50,00 por número!\n\nGaranta já o seu número da sorte antes que acabe:\n${shareUrl}`;

  const handleShareNativeOrModal = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareMessage,
          url: shareUrl,
        });
        toast.success('Rifa compartilhada com sucesso!', 'Compartilhado');
        return;
      } catch (e: any) {
        if (e.name !== 'AbortError') {
          setIsShareModalOpen(true);
        }
        return;
      }
    }
    setIsShareModalOpen(true);
  };

  const fallbackCopyText = (text: string) => {
    try {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand('copy');
      textArea.remove();
      setCopiedLink(true);
      toast.success('Link da rifa copiado com sucesso! Compartilhe com amigos e grupos.', 'Link Copiado');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err) {
      toast.info('Copie o link da barra de endereço.', 'Link da Rifa');
    }
  };

  const handleCopyShareLink = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          setCopiedLink(true);
          toast.success('Link da rifa copiado com sucesso! Compartilhe com amigos e grupos.', 'Link Copiado');
          setTimeout(() => setCopiedLink(false), 2500);
        })
        .catch(() => {
          fallbackCopyText(shareUrl);
        });
    } else {
      fallbackCopyText(shareUrl);
    }
  };

  const handleWhatsAppShare = () => {
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareMessage)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    toast.info('Abrindo WhatsApp para compartilhar a rifa...', 'WhatsApp');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBuyerPhone(formatPhone(e.target.value));
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBuyerCpf(formatCpf(e.target.value));
  };

  // Real-time listener para atualizar o status do modal Pix assim que houver confirmação/webhook
  useEffect(() => {
    if (!activeOrderId) return;
    const unsub = onSnapshot(doc(db, 'orders', activeOrderId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.status === 'paid') {
          setModalPixData((prev) => (prev ? { ...prev, status: 'paid' } : null));
          toast.success('Pagamento Pix processado com sucesso! Seus números foram emitidos.', 'Pagamento Aprovado');
        }
      }
    });
    return () => unsub();
  }, [activeOrderId, toast]);

  const handleModalSimulateSuccess = async () => {
    if (!activeOrderId) return;
    try {
      await simulatePixPaymentConfirmation(activeOrderId);
      setModalPixData((prev) => (prev ? { ...prev, status: 'paid' } : null));
    } catch (e) {
      console.error(e);
      toast.error('Erro ao confirmar simulação.', 'Erro');
    }
  };

  const handleModalViewReceipt = () => {
    if (activeOrderId) {
      navigate(`/comprovante/${activeOrderId}`);
    }
  };

  const handleToggleNumber = (num: number) => {
    if (unavailableNumbers.has(num)) return;

    const isCurrentlySelected = manualSelectedNumbers.includes(num);
    if (isCurrentlySelected) {
      const next = manualSelectedNumbers.filter(n => n !== num);
      setManualSelectedNumbers(next);
      setTicketsCount(next.length > 0 ? next.length : 1);
      toast.info(`Número #${formatTicketNumber(num)} removido da seleção.`, 'Número Removido');
    } else {
      const next = [...manualSelectedNumbers, num].sort((a, b) => a - b);
      setManualSelectedNumbers(next);
      setTicketsCount(next.length);
      toast.success(`Número #${formatTicketNumber(num)} selecionado! (${next.length} selecionado(s))`, 'Número Selecionado');
    }
  };

  const handleQuickQty = (qty: number) => {
    const capped = Math.min(qty, remainingAvailable);
    if (capped <= 0) return;
    const picked = generateRaffleTickets(capped, totalTickets, unavailableNumbers);
    setManualSelectedNumbers(picked);
    setTicketsCount(picked.length);
    toast.success(`${picked.length} número(s) selecionado(s) automaticamente na grade! Total: R$ ${formatCurrency(picked.length * pricePerTicket)}`, 'Seleção Automática');
  };

  const handleRandomize = () => {
    const qty = manualSelectedNumbers.length > 0 ? manualSelectedNumbers.length : Math.max(1, ticketsCount);
    const capped = Math.min(qty, remainingAvailable);
    if (capped <= 0) return;
    const picked = generateRaffleTickets(capped, totalTickets, unavailableNumbers);
    setManualSelectedNumbers(picked);
    setTicketsCount(picked.length);
    toast.success(`${picked.length} novo(s) número(s) da sorte sorteado(s) na grade!`, 'Números Sorteados');
  };

  const handleClearSelection = () => {
    setManualSelectedNumbers([]);
    setTicketsCount(1);
    toast.info('Seleção de números foi limpa.', 'Seleção Limpa');
  };

  const effectiveCount = manualSelectedNumbers.length > 0 
    ? manualSelectedNumbers.length 
    : Math.min(ticketsCount, remainingAvailable);

  const totalAmount = campaign 
    ? effectiveCount * pricePerTicket
    : 0;

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (isSoldOut) {
      setErrorMessage('Esta rifa já atingiu 100% dos números e está encerrada!');
      return;
    }

    if (!campaign || effectiveCount <= 0) {
      setErrorMessage('Selecione pelo menos 1 número para participar.');
      return;
    }

    if (buyerName.trim().length < 3) {
      setErrorMessage('Por favor, informe seu nome completo (mínimo 3 letras).');
      return;
    }

    const cleanPhoneDigits = buyerPhone.replace(/\D/g, '');
    if (cleanPhoneDigits.length < 10) {
      setErrorMessage('Por favor, informe um WhatsApp válido com DDD.');
      return;
    }

    const cleanCpfDigits = cleanCpf(buyerCpf);
    if (cleanCpfDigits.length !== 11 || !validateCpf(cleanCpfDigits)) {
      setErrorMessage('Por favor, informe um CPF válido (11 dígitos).');
      return;
    }

    if (!validateEmail(buyerEmail)) {
      setErrorMessage('Por favor, informe um e-mail válido para identificação da transação Pix.');
      return;
    }

    setSubmitting(true);
    try {
      let selectedNumbers: number[] = [];

      if (manualSelectedNumbers.length > 0) {
        // Validate none is taken
        const conflict = manualSelectedNumbers.find(n => unavailableNumbers.has(n));
        if (conflict) {
          setErrorMessage(`O número ${conflict} acabou de ser escolhido por outro participante. Por favor, escolha outro número.`);
          setSubmitting(false);
          return;
        }
        selectedNumbers = [...manualSelectedNumbers];
      } else {
        // Sorteio aleatório evitando rigidamente os números indisponíveis
        selectedNumbers = generateRaffleTickets(
          effectiveCount,
          totalTickets,
          unavailableNumbers
        );
      }

      if (selectedNumbers.length === 0) {
        setErrorMessage('Não há números suficientes disponíveis nesta rifa.');
        setSubmitting(false);
        return;
      }

      // 1. Gera cobrança Pix via Mercado Pago (Cloud Function/API ou payload nativo)
      const pixResponse = await gerarCobrancaPixMercadoPago({
        valor_total: Number(totalAmount.toFixed(2)),
        numeros_selecionados: selectedNumbers,
        comprador_nome: buyerName.trim(),
        comprador_email: buyerEmail.trim(),
        comprador_cpf: cleanCpfDigits,
        comprador_telefone: buyerPhone,
        descricao_rifa: campaign.title
      });

      // 2. Salva o pedido no banco de dados com todos os dados do comprador
      const orderRef = await addDoc(collection(db, 'orders'), {
        campaign_id: campaign.id,
        buyer_name: buyerName.trim(),
        buyer_phone: buyerPhone,
        buyer_cpf: cleanCpfDigits,
        buyer_email: buyerEmail.trim(),
        selected_numbers: selectedNumbers,
        total_amount: Number(totalAmount.toFixed(2)),
        status: 'pending',
        createdAt: serverTimestamp(),
        pix_code: pixResponse.pix_copia_e_cola,
        pix_payment_id: pixResponse.payment_id,
        pix_expiration: pixResponse.expiracao
      });

      // 3. Define os dados ativos e abre o modal interativo com QR Code e Copiar Pix
      setActiveOrderId(orderRef.id);
      setModalPixData({
        payment_id: pixResponse.payment_id,
        valor: Number(totalAmount.toFixed(2)),
        pix_copia_e_cola: pixResponse.pix_copia_e_cola,
        qr_code_base64: pixResponse.qr_code_base64,
        link_pagamento: pixResponse.link_pagamento,
        expiracao: pixResponse.expiracao,
        comprador_nome: buyerName.trim(),
        comprador_cpf: cleanCpfDigits,
        comprador_email: buyerEmail.trim(),
        comprador_telefone: buyerPhone,
        numeros_selecionados: selectedNumbers,
        descricao_rifa: campaign.title,
        status: 'pending'
      });
      setIsPixModalOpen(true);
      toast.success('Cobrança Pix gerada com sucesso! Escaneie o QR Code ou copie a chave.', 'Pix Mercado Pago');
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Erro ao gerar pedido Pix. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 pb-16 space-y-4">
      {campaign ? (
        <div className="space-y-4">
          {/* Hero do Prêmio Único: Show Completo do Grupo Part Negra */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl relative">
            <div className="relative aspect-video w-full overflow-hidden bg-neutral-950">
              <img
                src={campaign.imageUrl}
                alt={campaign.title}
                className="w-full h-full object-cover transition duration-300 hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/40 to-black/30" />
              
              <div className="absolute top-3 left-3 flex flex-wrap gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 px-3 py-1 rounded-full bg-neutral-950/85 backdrop-blur-md border border-emerald-500/30 flex items-center gap-1.5 shadow-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Rifa Oficial
                </span>
              </div>

              {/* Botão de Compartilhar no topo da imagem */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleShareNativeOrModal}
                  className="text-[11px] font-bold text-white bg-neutral-950/85 hover:bg-neutral-900 backdrop-blur-md border border-neutral-700/60 hover:border-emerald-500/50 px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg transition cursor-pointer active:scale-95"
                  title="Compartilhar esta rifa"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Compartilhar</span>
                </button>
              </div>
            </div>

            <div className="p-5">
              {/* Botão Prêmio Exclusivo alinhado à esquerda acima da palavra SHOW (sem fundo externo) */}
              <div className="flex justify-start mb-2.5">
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/90 border border-amber-400/90 text-amber-400 font-black text-[11px] tracking-wider uppercase shadow-md select-none transition hover:border-amber-300"
                >
                  <Music className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
                  <span>PRÊMIO EXCLUSIVO</span>
                </div>
              </div>

              <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
                {campaign.title}
              </h1>

              {/* Destaque Data à Escolha */}
              <div className="mt-2.5 flex items-center gap-2 text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-xl">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>Podendo escolher a data que preferir!</span>
              </div>

              {/* Frase Solicitada com R$ 50,00 */}
              <div className="mt-3.5 p-3.5 rounded-2xl bg-neutral-950 border border-neutral-800 text-xs text-neutral-300 leading-relaxed font-medium">
                Que tal ter um show completo do <strong className="text-white">Grupo Part Negra</strong> para seu evento, sua confraternização por apenas <strong className="text-emerald-400 font-mono font-bold">R$ 50,00 por número</strong>!
              </div>

              {/* Barra de Ações: Compartilhar Rifa */}
              <div className="mt-3.5 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleWhatsAppShare}
                  className="flex-1 py-2.5 px-3 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-[0.99] shadow-sm"
                  title="Compartilhar rifa no WhatsApp"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-400 fill-emerald-400/20" />
                  <span>Compartilhar no WhatsApp</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopyShareLink}
                  className="py-2.5 px-3.5 rounded-2xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-[0.99]"
                  title="Copiar link da rifa"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400 stroke-[3]" /> : <Copy className="w-4 h-4 text-neutral-400" />}
                  <span className="hidden sm:inline">{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleShareNativeOrModal}
                  className="py-2.5 px-3 rounded-2xl bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition cursor-pointer active:scale-[0.99]"
                  title="Mais opções de compartilhamento"
                >
                  <Share2 className="w-4 h-4 text-emerald-400" />
                </button>
              </div>

              {/* BARRA DE PROGRESSO */}
              <div className="mt-5 p-4 rounded-2xl bg-neutral-950 border border-neutral-800/90 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-neutral-200 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-400" />
                    Progresso da Rifa
                  </span>
                  <span className="font-mono font-black text-emerald-400 text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    {progress.percent}%
                  </span>
                </div>

                {/* Progress Bar Track */}
                <div className="w-full h-3.5 bg-neutral-900 rounded-full overflow-hidden p-0.5 border border-neutral-800 relative">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-emerald-300 rounded-full transition-all duration-700 relative shadow-lg shadow-emerald-500/30"
                    style={{ width: `${Math.max(4, progress.percent)}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Seletor de Números: Automático ou Pessoalmente na Grade */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-2xl space-y-4">
            <div>
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  Escolha seus Números
                </h2>
                <span className="text-[10px] text-emerald-400 font-mono font-semibold bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  {remainingAvailable} de {totalTickets} disponíveis
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1 leading-snug">
                Selecione automaticamente pelos botões rápidos ou escolha pessoalmente na grade abaixo.
              </p>
            </div>

            {isSoldOut ? (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-white">Rifa 100% Concluída!</p>
                <p className="text-[11px] text-neutral-400">
                  Todos os 300 números foram cumpridos. Acompanhe o sorteio pela Loteria Federal!
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* 1. SELEÇÃO AUTOMÁTICA RÁPIDA */}
                <div className="p-3 bg-neutral-950 border border-neutral-800/80 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-neutral-300 flex items-center gap-1.5 text-[11px]">
                      <Zap className="w-3.5 h-3.5 text-amber-400" />
                      Seleção Rápida Automática:
                    </span>
                    <button
                      type="button"
                      onClick={handleRandomize}
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition cursor-pointer font-medium"
                      title="Sortear outros números aleatórios"
                    >
                      <Sparkles className="w-3 h-3" />
                      Sortear Outros
                    </button>
                  </div>

                  {/* Quick Select Buttons: +1, +3, +5, +10 */}
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 3, 5, 10].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        disabled={remainingAvailable < qty}
                        onClick={() => handleQuickQty(qty)}
                        className={`py-2.5 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                          effectiveCount === qty
                            ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/25 scale-[1.02]'
                            : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-white'
                        }`}
                      >
                        +{qty}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Resumo de Números Escolhidos */}
                {manualSelectedNumbers.length > 0 && (
                  <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {manualSelectedNumbers.length} número(s) selecionado(s):
                      </span>
                      <button
                        type="button"
                        onClick={handleClearSelection}
                        className="text-[10px] text-neutral-400 hover:text-red-400 transition cursor-pointer underline"
                      >
                        Limpar Seleção
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto pr-1">
                      {manualSelectedNumbers.map((num) => (
                        <span
                          key={num}
                          onClick={() => handleToggleNumber(num)}
                          className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] font-bold flex items-center gap-1 cursor-pointer hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-300 transition"
                          title="Clique para remover"
                        >
                          {formatTicketNumber(num)}
                          <span className="text-[9px] text-neutral-400">×</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. GRADE DE NÚMEROS: TOTALMENTE ATIVA E VISÍVEL */}
                <div className="pt-1">
                  <TicketGrid
                    totalTickets={totalTickets}
                    selectedNumbers={manualSelectedNumbers}
                    unavailableNumbers={unavailableNumbers}
                    onToggleNumber={handleToggleNumber}
                    pricePerTicket={pricePerTicket}
                  />
                </div>
              </div>
            )}

            {/* Formulário de Identificação */}
            {!isSoldOut && (
              <form onSubmit={handleCheckout} className="space-y-3 pt-2">
                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold block mb-1">
                    Seu Nome Completo
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Nome e Sobrenome"
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-neutral-400 font-semibold block mb-1">
                      CPF do Titular
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="000.000.000-00"
                      value={buyerCpf}
                      onChange={handleCpfChange}
                      maxLength={14}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500 font-mono transition"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-neutral-400 font-semibold block mb-1">
                      WhatsApp com DDD
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="(00) 00000-0000"
                      value={buyerPhone}
                      onChange={handlePhoneChange}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500 font-mono transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-neutral-400 font-semibold block mb-1">
                    Seu E-mail (Para confirmação Pix)
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="exemplo@email.com"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl px-4 py-3 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                {errorMessage && (
                  <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-2xl text-xs text-red-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                {/* Total Calculation Bar */}
                <div className="p-3.5 bg-neutral-950 rounded-2xl border border-neutral-800/80 flex items-center justify-between text-xs font-mono">
                  <span className="text-neutral-400">
                    {effectiveCount} número(s) x R$ {formatCurrency(pricePerTicket)}
                  </span>
                  <span className="font-bold text-white text-base">
                    Total: <span className="text-emerald-400">R$ {formatCurrency(totalAmount)}</span>
                  </span>
                </div>

                {/* CTA Submit Button */}
                <button
                  type="submit"
                  disabled={submitting || remainingAvailable <= 0}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-2xl text-sm flex items-center justify-center gap-2 transition shadow-xl shadow-emerald-500/20 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <TicketIcon className="w-5 h-5 fill-neutral-950 stroke-neutral-950" />
                      Garantir Números da Sorte
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Security Guarantee Badges */}
            <div className="pt-2 flex items-center justify-center gap-4 text-[11px] text-neutral-500">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Pagamento Pix Seguro
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-emerald-500" />
                Baixa Imediata
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-20 text-neutral-500 text-xs bg-neutral-900 border border-neutral-800 rounded-3xl p-8">
          Nenhuma rifa ativa no momento.
        </div>
      )}

      {/* Modal de Compartilhamento da Rifa */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-3xl w-full max-w-sm space-y-4 shadow-2xl relative">
            <div className="flex justify-between items-center pb-2 border-b border-neutral-800">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Share2 className="w-4 h-4 text-emerald-400" />
                Compartilhar Rifa
              </h3>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3 bg-neutral-950 rounded-2xl border border-neutral-800 flex items-center gap-3">
                <img
                  src={campaign?.imageUrl}
                  alt={campaign?.title}
                  className="w-12 h-12 rounded-xl object-cover bg-neutral-900 border border-neutral-800 flex-shrink-0"
                />
                <div className="overflow-hidden">
                  <p className="text-xs font-bold text-white truncate">{campaign?.title}</p>
                  <p className="text-[11px] text-emerald-400 font-mono font-semibold">
                    R$ {formatCurrency(pricePerTicket)} por número • {totalTickets} números
                  </p>
                </div>
              </div>

              {/* Botão WhatsApp */}
              <button
                type="button"
                onClick={handleWhatsAppShare}
                className="w-full py-3 px-4 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition cursor-pointer active:scale-98"
              >
                <MessageCircle className="w-4 h-4 text-emerald-400" />
                Compartilhar no WhatsApp
              </button>

              {/* Copiar Link */}
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-semibold text-neutral-400 block">
                  Link direto da rifa:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs font-mono text-neutral-300 truncate focus:outline-none select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold text-xs rounded-xl flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap active:scale-95"
                  >
                    {copiedLink ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedLink ? 'Copiado!' : 'Copiar'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Interativo Pix Mercado Pago com QR Code e Copiar Chave */}
      <PixPaymentModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        pixData={modalPixData}
        onSimulateSuccess={handleModalSimulateSuccess}
        onViewReceipt={handleModalViewReceipt}
      />
    </div>
  );
}
