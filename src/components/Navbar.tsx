import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Search, ShieldCheck, LayoutDashboard, Ticket } from 'lucide-react';

export default function Navbar() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-neutral-950/85 border-b border-neutral-800/80 print:hidden">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo / Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-400 flex items-center justify-center text-neutral-950 font-black shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
            <Ticket className="w-5 h-5 fill-neutral-950 stroke-neutral-950" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tight text-white leading-tight">
              Rifas <span className="text-emerald-400">GPN</span>
            </span>
            <span className="text-[10px] text-neutral-400 font-medium tracking-wide">
              Sorteios 100% Seguros
            </span>
          </div>
        </Link>

        {/* Navigation Actions */}
        <nav className="flex items-center gap-2 sm:gap-3" aria-label="Navegação principal">
          <Link
            to="/meus-bilhetes"
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all ${
              location.pathname === '/meus-bilhetes'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-neutral-900/90 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
            }`}
          >
            <Search className="w-3.5 h-3.5 text-emerald-400" />
            <span>Meus Bilhetes</span>
          </Link>

          <Link
            to="/admin"
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-all ${
              location.pathname === '/admin'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-neutral-900/90 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
            }`}
            title="Painel Administrativo"
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-neutral-400" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
