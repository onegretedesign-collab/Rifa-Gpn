import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Copy, Check, Clock, X, CheckCircle2, ShieldCheck, Loader2, MessageCircle, AlertCircle, ExternalLink, Zap } from 'lucide-react';
import { formatCurrency, formatTicketNumber, formatPhone, formatCpf, generateWhatsAppTicketMessage, generateWhatsAppLink } from '../utils/raffle';
import { useToast } from './Toast';

export interface PixData {
  payment_id?: string | number;
  valor: number;
  pix_copia_e_cola: string;
  qr_code_base64?: string;
  link_pagamento?: string;
  expiracao?: string;
  comprador_nome?: string;
  comprador_email?: string;
  comprador_cpf?: string;
  comprador_telefone?: string;
  numeros_selecionados?: (number | string)[];
  descricao_rifa?: string;
  status?: 'pending' | 'paid' | 'approved' | 'expired';
}

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  pixData: PixData | null;
  onSimulateSuccess?: () => void;
  onViewReceipt?: () => void;
}

export default function PixPaymentModal({
  isOpen,
  onClose,
  pixData,
  onSimulateSuccess,
  onViewReceipt
}: PixPaymentModalProps) {
  const toast = useToast();
  const [copied, setCopied] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60); // 15 minutos em segundos

  // Sincroniza o timer com data de expiração se informada
  useEffect(() => {
    if (!isOpen || !pixData) return;

    if (pixData.expiracao) {
      const expDate = new Date(pixData.expiracao).getTime();
      const diffSecs = Math.max(0, Math.floor((expDate - Date.now()) / 1000));
      setTimeLeft(diffSecs > 0 ? diffSecs : 15 * 60);
    } else {
      setTimeLeft(15 * 60);
    }
  }, [isOpen, pixData]);

  // Contagem regressiva
  useEffect(() => {
    if (!isOpen || pixData?.status === 'paid' || pixData?.status === 'approved') return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, pixData?.status]);

  if (!isOpen || !pixData) return null;

  const isPaid = pixData.status === 'paid' || pixData.status === 'approved';
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedCountdown = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const handleCopyPix = () => {
    if (!pixData.pix_copia_e_cola) return;

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
        setCopied(true);
        toast.success('Código Pix Copia e Cola copiado com sucesso!', 'Código Copiado');
        setTimeout(() => setCopied(false), 2500);
      } catch {
        toast.info('Selecione o código abaixo e copie manualmente.', 'Pix Copia e Cola');
      }
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(pixData.pix_copia_e_cola)
        .then(() => {
          setCopied(true);
          toast.success('Código Pix Copia e Cola copiado com sucesso!', 'Código Copiado');
          setTimeout(() => setCopied(false), 2500);
        })
        .catch(() => fallbackCopy(pixData.pix_copia_e_cola));
    } else {
      fallbackCopy(pixData.pix_copia_e_cola);
    }
  };

  const rawNumbers = pixData.numeros_selecionados || [];
  const numbersList = rawNumbers.map((n) => typeof n === 'number' ? formatTicketNumber(n) : String(n));

  // WhatsApp Message
  const waMessage = generateWhatsAppTicketMessage({
    buyerName: pixData.comprador_nome || 'Participante',
    buyerPhone: pixData.comprador_telefone,
    orderId: pixData.payment_id ? String(pixData.payment_id) : undefined,
    selectedNumbers: rawNumbers.map(n => Number(n)).filter(n => !isNaN(n)),
    totalAmount: pixData.valor,
    totalTickets: 300
  });

  const waLink = pixData.comprador_telefone 
    ? generateWhatsAppLink(pixData.comprador_telefone, waMessage)
    : '#';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div 
        className="relative w-full max-w-lg bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden my-6 transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pix-modal-title"
      >
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-800 bg-neutral-950/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h2 id="pix-modal-title" className="text-sm font-black text-white">
                Pagamento via Pix Mercado Pago
              </h2>
              <span className="text-[10px] text-neutral-400 font-mono block">
                {pixData.payment_id ? `ID #${String(pixData.payment_id).slice(-8).toUpperCase()}` : 'Aguardando liquidação'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isPaid && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-full text-[11px] font-semibold font-mono">
                <Clock className="w-3.5 h-3.5" />
                <span>{formattedCountdown}</span>
              </div>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-neutral-400 hover:text-white rounded-xl hover:bg-neutral-800 transition cursor-pointer"
              aria-label="Fechar modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Se aprovado/pago */}
          {isPaid ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center animate-bounce shadow-xl shadow-emerald-500/20">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>
              <h3 className="text-xl font-black text-white">Pagamento Confirmado!</h3>
              <p className="text-xs text-neutral-300 max-w-sm mx-auto leading-relaxed">
                Seus números foram registrados e reservados com sucesso para o sorteio do <strong>Show Completo do Grupo Part Negra</strong>.
              </p>

              {pixData.comprador_telefone && (
                <div className="pt-2">
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-2xl text-xs transition shadow-lg shadow-emerald-500/20"
                  >
                    <MessageCircle className="w-4 h-4 fill-current" />
                    <span>Salvar Números no WhatsApp</span>
                  </a>
                </div>
              )}

              {onViewReceipt && (
                <div>
                  <button
                    type="button"
                    onClick={onViewReceipt}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold underline underline-offset-4"
                  >
                    Ver comprovante oficial completo
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Valor Total */}
              <div className="text-center py-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">
                  Total a Transferir
                </span>
                <p className="text-3xl font-black text-emerald-400 font-mono tracking-tight mt-0.5">
                  R$ {formatCurrency(pixData.valor)}
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  {pixData.descricao_rifa || 'Show Completo do Grupo Part Negra'}
                </p>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-inner mx-auto max-w-[220px]">
                {pixData.qr_code_base64 ? (
                  <img
                    src={`data:image/png;base64,${pixData.qr_code_base64}`}
                    alt="QR Code Pix Mercado Pago"
                    className="w-44 h-44 object-contain rounded"
                  />
                ) : (
                  <QRCodeSVG
                    value={pixData.pix_copia_e_cola || '00020126580014br.gov.bcb.pix'}
                    size={176}
                    level="M"
                    className="rounded"
                  />
                )}
                <p className="text-[10px] text-neutral-600 font-medium mt-2 text-center">
                  Escaneie no aplicativo do seu banco
                </p>
              </div>

              {/* Pix Copia e Cola */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-neutral-400 font-semibold">
                  <span>Código Pix Copia e Cola:</span>
                  {copied && (
                    <span className="text-emerald-400 font-bold text-[11px] flex items-center gap-1">
                      <Check className="w-3.5 h-3.5 stroke-[3]" /> Copiado!
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={pixData.pix_copia_e_cola || ''}
                    className={`w-full bg-neutral-950 border rounded-xl px-3 py-3 text-xs font-mono truncate focus:outline-none select-all transition ${
                      copied ? 'border-emerald-500 text-emerald-300' : 'border-neutral-800 text-neutral-300'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleCopyPix}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black rounded-xl text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-emerald-500/20 active:scale-[0.99] cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                  <span>{copied ? 'Código Pix Copiado com Sucesso!' : 'Copiar Código Pix'}</span>
                </button>
              </div>

              {/* Resumo do Pedido Mercado Pago */}
              <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 text-xs space-y-2 font-mono">
                <div className="flex justify-between items-center text-neutral-400 font-sans pb-1.5 border-b border-neutral-800/80 font-bold text-[11px]">
                  <span>Resumo do Pedido</span>
                  <span className="text-emerald-400">Mercado Pago</span>
                </div>

                {pixData.comprador_nome && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 font-sans">Comprador:</span>
                    <span className="text-white font-sans font-medium">{pixData.comprador_nome}</span>
                  </div>
                )}

                {pixData.comprador_cpf && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 font-sans">CPF:</span>
                    <span className="text-neutral-300">{formatCpf(pixData.comprador_cpf)}</span>
                  </div>
                )}

                {pixData.comprador_email && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 font-sans">E-mail:</span>
                    <span className="text-neutral-300 truncate max-w-[200px]">{pixData.comprador_email}</span>
                  </div>
                )}

                {pixData.comprador_telefone && (
                  <div className="flex justify-between items-center">
                    <span className="text-neutral-500 font-sans">WhatsApp:</span>
                    <span className="text-neutral-300">{formatPhone(pixData.comprador_telefone)}</span>
                  </div>
                )}

                {numbersList.length > 0 && (
                  <div className="pt-2 border-t border-neutral-800/80">
                    <div className="flex justify-between text-neutral-400 mb-1 font-sans">
                      <span>Números Reservados ({numbersList.length}):</span>
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {numbersList.map((numStr) => (
                        <span
                          key={numStr}
                          className="px-2 py-0.5 bg-neutral-900 border border-neutral-800 text-emerald-400 font-bold text-[11px] rounded-lg"
                        >
                          {numStr}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Informações de Baixa Automática */}
              <div className="flex items-center gap-2 p-3 bg-neutral-950/80 border border-neutral-800/80 rounded-2xl text-[11px] text-neutral-400">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-400 flex-shrink-0" />
                <span>Identificação automática após a transferência. O comprovante é gerado instantaneamente.</span>
              </div>

              {/* Botão de Simulação de Pagamento para Testes */}
              {onSimulateSuccess && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onSimulateSuccess}
                    className="w-full py-2.5 bg-neutral-950 hover:bg-neutral-800 border border-emerald-500/30 hover:border-emerald-500 text-emerald-400 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Simular Pagamento Aprovado (Teste)</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
