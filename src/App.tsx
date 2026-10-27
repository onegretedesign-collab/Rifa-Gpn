import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import PixPayment from './pages/PixPayment';
import ReceiptScreen from './pages/ReceiptScreen';
import MyTicketsScreen from './pages/MyTicketsScreen';
import AdminDashboard from './pages/AdminDashboard';
import { ToastProvider } from './components/Toast';

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="bg-neutral-950 min-h-screen text-neutral-100 font-sans selection:bg-emerald-500 selection:text-neutral-950 flex flex-col">
          <Navbar />
          <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/pagamento/:orderId" element={<PixPayment />} />
            <Route path="/comprovante/:orderId" element={<ReceiptScreen />} />
            <Route path="/meus-bilhetes" element={<MyTicketsScreen />} />
            <Route path="/admin" element={<AdminDashboard />} />
          </Routes>
        </main>
        <footer className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-600 print:hidden">
          <div className="max-w-md mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>© 2026 Rifas GPN • Todos os direitos reservados.</span>
            <span className="text-[10px] text-neutral-500">Sorteios auditados pela Loteria Federal</span>
          </div>
        </footer>
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}
