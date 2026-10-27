import React, { useState, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, Check } from 'lucide-react';
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

  // Filtered numbers 1 to totalTickets
  const displayedTickets = useMemo(() => {
    const trimmed = searchQuery.trim();
    if (trimmed !== '') {
      const searchNum = parseInt(trimmed, 10);
      if (!isNaN(searchNum) && searchNum >= 1 && searchNum <= totalTickets) {
        return [searchNum];
      }
      const matches: number[] = [];
      for (let i = 1; i <= totalTickets && matches.length < 50; i++) {
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
    <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            Grade de Números (1 a {totalTickets})
          </h3>
          <p className="text-[11px] text-neutral-400">
            Clique nos números para escolher os seus bilhetes da sorte
          </p>
        </div>

        {/* Search within grid */}
        <div className="relative w-full sm:w-44">
          <input
            type="text"
            placeholder="Buscar número..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value.replace(/\D/g, ''))}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-xl py-1.5 pl-8 pr-3 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-emerald-500"
          />
          <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-2.5" />
        </div>
      </div>

      {/* Quick Interval Range Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-mono">
        <button
          type="button"
          onClick={() => { setActiveRange('all'); setSearchQuery(''); }}
          className={`px-3 py-1 rounded-xl transition ${
            activeRange === 'all' && searchQuery === ''
              ? 'bg-emerald-500 text-neutral-950 font-bold'
              : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          Todos (300)
        </button>
        <button
          type="button"
          onClick={() => { setActiveRange('1-100'); setSearchQuery(''); }}
          className={`px-3 py-1 rounded-xl transition ${
            activeRange === '1-100' && searchQuery === ''
              ? 'bg-emerald-500 text-neutral-950 font-bold'
              : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          001 - 100
        </button>
        <button
          type="button"
          onClick={() => { setActiveRange('101-200'); setSearchQuery(''); }}
          className={`px-3 py-1 rounded-xl transition ${
            activeRange === '101-200' && searchQuery === ''
              ? 'bg-emerald-500 text-neutral-950 font-bold'
              : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          101 - 200
        </button>
        <button
          type="button"
          onClick={() => { setActiveRange('201-300'); setSearchQuery(''); }}
          className={`px-3 py-1 rounded-xl transition ${
            activeRange === '201-300' && searchQuery === ''
              ? 'bg-emerald-500 text-neutral-950 font-bold'
              : 'bg-neutral-950 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          201 - 300
        </button>
      </div>

      {/* Legend & Selection Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-neutral-400 bg-neutral-950 p-2.5 rounded-2xl border border-neutral-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-neutral-900 border border-neutral-700" />
            <span>Disponível</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-emerald-500 border border-emerald-400" />
            <span className="text-emerald-400 font-medium">Escolhido ({selectedNumbers.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-neutral-800 border border-neutral-700 opacity-40" />
            <span>Pago</span>
          </div>
        </div>

        {selectedNumbers.length > 0 && (
          <span className="font-mono text-emerald-400 font-bold">
            Total: R$ {formatCurrency(selectedNumbers.length * pricePerTicket)}
          </span>
        )}
      </div>

      {/* Numbers Grid */}
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
              className={`py-2 px-1 text-center font-mono text-xs rounded-xl transition-all flex items-center justify-center relative cursor-pointer ${
                isTaken
                  ? 'bg-neutral-800/40 text-neutral-600 line-through cursor-not-allowed border border-neutral-800'
                  : isSelected
                  ? 'bg-emerald-500 text-neutral-950 font-bold shadow-md shadow-emerald-500/30 scale-105 z-10'
                  : 'bg-neutral-950 text-neutral-300 border border-neutral-800 hover:border-emerald-500/50 hover:text-white'
              }`}
              title={isTaken ? `Número #${formatTicketNumber(num)} (Já preenchido/indisponível)` : `Número #${formatTicketNumber(num)}`}
            >
              {formatTicketNumber(num)}
              {isSelected && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-neutral-950 rounded-full flex items-center justify-center text-[8px] text-emerald-400 font-bold border border-emerald-500">
                  <Check className="w-2 h-2" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
