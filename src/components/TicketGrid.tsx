import React, { useState, useMemo } from 'react';
import { Search, Check, Lock, Radio } from 'lucide-react';
import { formatTicketNumber, formatCurrency } from '../utils/raffle';

interface TicketGridProps {
  totalTickets: number;
  selectedNumbers: number[];
  paidNumbers?: Set<number>;
  unavailableNumbers?: Set<number>;
  onToggleNumber: (num: number) => void;
  pricePerTicket: number;
}

export default function TicketGrid({
  totalTickets = 300,
  selectedNumbers,
  paidNumbers = new Set(),
  unavailableNumbers,
  onToggleNumber,
  pricePerTicket
}: TicketGridProps) {
  const [activeRange, setActiveRange] = useState<'all' | '1-100' | '101-200' | '201-300'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const effectiveUnavailable = useMemo(() => {
    return unavailableNumbers || paidNumbers;
  }, [unavailableNumbers, paidNumbers]);

  const selectedSet = useMemo(() => new Set(selectedNumbers), [selectedNumbers]);

  // Quantidade de números já saídos e disponíveis
  const soldCount = effectiveUnavailable.size;
  const availableCount = Math.max(0, totalTickets - soldCount);

  // Filtered numbers 1 to totalTickets
  const displayedTickets = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (trimmed !== '') {
      const searchNum = parseInt(trimmed, 10);
      if (!isNaN(searchNum) && searchNum >= 1 && searchNum <= totalTickets) {
        return [searchNum];
      }
      const matches: number[] = [];
      for (let i = 1; i <= totalTickets && matches.length < 60; i++) {
        if (formatTicketNumber(i).includes(trimmed)) {
          matches.push(i);
        }
      }
      return matches;
    }

    let start = 1;
    let end = totalTickets;

    if (activeRange === '1-100') {
      start = 1;
      end = Math.min(100, totalTickets);
    } else if (activeRange === '101-200') {
      start = 101;
      end = Math.min(200, totalTickets);
    } else if (activeRange === '201-300') {
      start = 201;
      end = Math.min(300, totalTickets);
    }

    const result: number[] = [];
    for (let i = start; i <= end; i++) {
      result.push(i);
    }
    return result;
  }, [searchQuery, activeRange, totalTickets]);

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4">
      {/* Top Header with Live Real-time Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-black text-white">
              Grade Oficial de Números (1 a {totalTickets})
            </h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Tempo Real
            </span>
          </div>
          <p className="text-xs text-neutral-400 mt-0.5">
            Os números que já saíram são marcados automaticamente em todos os aparelhos
          </p>
        </div>

        {/* Search within grid */}
        <div className="relative w-full sm:w-48">
          <input
            type="text"
            placeholder="Buscar número (ex: 042)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-2xl py-2 pl-9 pr-3 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-emerald-500 transition"
          />
          <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-2.5" />
        </div>
      </div>

      {/* Live Counter Badges: Disponíveis vs Já Saíram */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="p-2 sm:p-2.5 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm bg-neutral-900 border border-neutral-600 shrink-0" />
            <span className="text-neutral-300 font-medium text-[11px] sm:text-xs truncate">Disponíveis</span>
          </div>
          <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm shrink-0">{availableCount}</span>
        </div>

        <div className="p-2 sm:p-2.5 rounded-2xl bg-red-950/20 border border-red-500/30 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm bg-red-950 border border-red-500/60 shrink-0" />
            <span className="text-red-300 font-medium text-[11px] sm:text-xs truncate">Já Saíram</span>
          </div>
          <span className="font-mono font-black text-red-400 text-xs sm:text-sm shrink-0">{soldCount}</span>
        </div>

        <div className="p-2 sm:p-2.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 border border-emerald-400 shrink-0" />
            <span className="text-emerald-300 font-medium text-[11px] sm:text-xs truncate">Escolhidos</span>
          </div>
          <span className="font-mono font-black text-emerald-400 text-xs sm:text-sm shrink-0">
            {selectedNumbers.length}
          </span>
        </div>
      </div>

      {/* Quick Interval Range Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-mono">
        <button
          type="button"
          onClick={() => { setActiveRange('all'); setSearchQuery(''); }}
          className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer font-bold ${
            activeRange === 'all' && searchQuery === ''
              ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
              : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          Todos (300)
        </button>
        <button
          type="button"
          onClick={() => { setActiveRange('1-100'); setSearchQuery(''); }}
          className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer font-bold ${
            activeRange === '1-100' && searchQuery === ''
              ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
              : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          001 - 100
        </button>
        <button
          type="button"
          onClick={() => { setActiveRange('101-200'); setSearchQuery(''); }}
          className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer font-bold ${
            activeRange === '101-200' && searchQuery === ''
              ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
              : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          101 - 200
        </button>
        <button
          type="button"
          onClick={() => { setActiveRange('201-300'); setSearchQuery(''); }}
          className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer font-bold ${
            activeRange === '201-300' && searchQuery === ''
              ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20'
              : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          201 - 300
        </button>
      </div>

      {/* Numbers Grid in Standard Compact Layout */}
      <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 max-h-72 overflow-y-auto pr-1 select-none">
        {displayedTickets.map((num) => {
          const isTaken = effectiveUnavailable.has(num);
          const isSelected = selectedSet.has(num);

          return (
            <button
              key={num}
              type="button"
              disabled={isTaken}
              onClick={() => onToggleNumber(num)}
              className={`py-2 px-1 text-center font-mono text-xs font-bold rounded-xl flex items-center justify-center relative cursor-pointer transition-all ${
                isTaken
                  ? 'bg-red-950/40 text-red-400 line-through cursor-not-allowed border border-red-500/30 opacity-75'
                  : isSelected
                  ? 'bg-emerald-500 text-neutral-950 font-extrabold shadow-md shadow-emerald-500/30 scale-105 z-10'
                  : 'bg-neutral-950 text-neutral-300 border border-neutral-800 hover:border-emerald-500/50 hover:text-white'
              }`}
              title={isTaken ? `Número #${formatTicketNumber(num)} - Já saiu (Indisponível)` : `Número #${formatTicketNumber(num)} - Disponível por R$ ${formatCurrency(pricePerTicket)}`}
            >
              <span>{formatTicketNumber(num)}</span>
              {isSelected && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-neutral-950 text-emerald-400 rounded-full flex items-center justify-center border border-emerald-500 shadow-sm">
                  <Check className="w-2 h-2 stroke-[3]" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
