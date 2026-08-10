import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import CashDenominationCounter from '@/components/CashDenominationCounter';

const CloseCashierModal = ({ isOpen, onClose, onConfirm, session }) => {
  const { user } = useAuth();
  const [saldoFinal, setSaldoFinal] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [salesTotal, setSalesTotal] = useState(0);
  const [paymentSummary, setPaymentSummary] = useState({
    dinheiro: 0,
    pix: 0,
    qrcode: 0,
    debito: 0,
    credito: 0,
    fiado: 0,
    consumo: 0
  });
  const [opsSummary, setOpsSummary] = useState({
    suprimentos: 0,
    retiradas: 0
  });
  const [counterResetSignal, setCounterResetSignal] = useState(0);
  const [counterDetails, setCounterDetails] = useState(null);
  const [hasCounterData, setHasCounterData] = useState(false);
  const hasUsedCounterRef = useRef(false);

  const totalVendas = Number(salesTotal || 0);
  const saldoEsperadoDia =
    (Number(session?.saldo_inicial) || 0) +
    totalVendas +
    (Number(opsSummary.suprimentos) || 0) -
    (Number(opsSummary.retiradas) || 0);
  const diferenca = (parseFloat(saldoFinal) || 0) - saldoEsperadoDia;
  const saldoFinalPreview = parseFloat(saldoFinal) || 0;

  const normalizeMethod = (method) => {
    const raw = (method || '').toString().trim().toLowerCase();
    const clean = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (clean.includes('dinheiro')) return 'dinheiro';
    if (clean.includes('pix')) return 'pix';
    if (clean.includes('qrcode') || clean.includes('qr code') || clean === 'qr' || clean.includes('qr_')) return 'qrcode';
    if (clean.includes('debito')) return 'debito';
    if (clean.includes('credito')) return 'credito';
    if (clean.includes('fiado')) return 'fiado';
    if (clean.includes('consumo')) return 'consumo';
    return null;
  };

  const loadPaymentSummary = useCallback(async () => {
    if (!user || !session?.data_hora) return;
    setLoadingPayments(true);
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      const startIso = start.toISOString();
      const endIso = end.toISOString();

      const paymentsBase = { dinheiro: 0, pix: 0, qrcode: 0, debito: 0, credito: 0, fiado: 0, consumo: 0 };

      const { data: movimentos, error: movError } = await supabase
        .from('caixa_movimentos')
        .select('tipo, valor, forma_pagamento, data_movimentacao')
        .eq('user_id', user.id)
        .in('tipo', ['venda', 'suprimento', 'retirada'])
        .gte('data_movimentacao', startIso)
        .lte('data_movimentacao', endIso);

      if (movError) throw movError;

      const opsBase = { suprimentos: 0, retiradas: 0 };
      (movimentos || []).forEach((m) => {
        const val = Number(m?.valor || 0);
        if (m?.tipo === 'suprimento') opsBase.suprimentos += val;
        if (m?.tipo === 'retirada') opsBase.retiradas += val;
      });

      let vendasTotal = 0;
      (movimentos || []).forEach((m) => {
        if (m?.tipo !== 'venda') return;
        const key = normalizeMethod(m?.forma_pagamento);
        if (key === 'fiado') return;
        const valor = Number(m?.valor || 0);
        vendasTotal += valor;
        if (!key) return;
        paymentsBase[key] += valor;
      });

      // Fiado aparece apenas visualmente no fechamento (nao entra em vendasTotal/saldo esperado).
      let fiadoVisualTotal = 0;
      let vendasQuery = supabase
        .from('vendas')
        .select('id, total, forma_pagamento')
        .eq('user_id', user.id)
        .eq('status', 'concluido')
        .or(`and(data_criacao.gte.${startIso},data_criacao.lte.${endIso}),and(data_hora.gte.${startIso},data_hora.lte.${endIso})`);

      const { data: vendasDia, error: vendasDiaError } = await vendasQuery;
      if (vendasDiaError) throw vendasDiaError;

      const saleIds = (vendasDia || []).map((v) => v.id).filter(Boolean);
      let pagamentosDia = [];
      if (saleIds.length > 0) {
        const { data: pagamentosData, error: pagamentosError } = await supabase
          .from('venda_pagamentos')
          .select('venda_id, forma_pagamento, valor')
          .eq('user_id', user.id)
          .in('venda_id', saleIds);

        if (pagamentosError) throw pagamentosError;
        pagamentosDia = pagamentosData || [];
      }

      const pagamentosBySaleId = new Map();
      (pagamentosDia || []).forEach((p) => {
        if (!p?.venda_id) return;
        if (!pagamentosBySaleId.has(p.venda_id)) pagamentosBySaleId.set(p.venda_id, []);
        pagamentosBySaleId.get(p.venda_id).push(p);
      });

      (vendasDia || []).forEach((venda) => {
        const pays = pagamentosBySaleId.get(venda.id) || [];
        if (pays.length > 0) {
          pays.forEach((p) => {
            if (normalizeMethod(p?.forma_pagamento) === 'fiado') {
              fiadoVisualTotal += Number(p?.valor || 0);
            }
          });
          return;
        }

        if (normalizeMethod(venda?.forma_pagamento) === 'fiado') {
          fiadoVisualTotal += Number(venda?.total || 0);
        }
      });

      paymentsBase.fiado = fiadoVisualTotal;

      setPaymentSummary(paymentsBase);
      setOpsSummary(opsBase);
      setSalesTotal(vendasTotal);
    } catch (err) {
      console.error('Error loading payment summary:', err);
    } finally {
      setLoadingPayments(false);
    }
  }, [user, session]);

  useEffect(() => {
    if (isOpen) {
      setSaldoFinal('');
      setObservacoes('');
      setCounterResetSignal((prev) => prev + 1);
      setCounterDetails(null);
      setHasCounterData(false);
      hasUsedCounterRef.current = false;
      loadPaymentSummary();
    }
  }, [isOpen, loadPaymentSummary]);

  const handleCounterTotalChange = (total, hasAnyCount, details) => {
    setHasCounterData(hasAnyCount);
    setCounterDetails(hasAnyCount ? details : null);

    if (hasAnyCount) {
      hasUsedCounterRef.current = true;
      setSaldoFinal(total.toFixed(2));
      return;
    }

    if (hasUsedCounterRef.current) {
      setSaldoFinal('0.00');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const saldo = parseFloat(saldoFinal);
    if (isNaN(saldo) || saldo < 0) return alert('Saldo final invalido.');

    const baseObs = (observacoes || '').trim();
    const detalhes = hasCounterData ? (counterDetails?.summaryText || '') : '';
    const finalObservacoes = detalhes ? (baseObs ? `${baseObs}\n\n${detalhes}` : detalhes) : baseObs;

    onConfirm(saldo, finalObservacoes);
  };

  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[#1a2332] rounded-xl border border-gray-700 shadow-2xl w-full max-w-7xl overflow-hidden max-h-[92vh] flex flex-col"
        >
          <div className="bg-[#2d3e52] p-4 border-b border-gray-600 flex justify-between items-center">
            <div className="flex items-center gap-2 text-white font-bold">
              <Lock className="w-5 h-5 text-red-500" />
              <span>FECHAR CAIXA</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
              <div className="space-y-4">
                <div className="bg-[#2d3e52] rounded p-4 space-y-2 text-sm border border-gray-600">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Funcionario:</span>
                    <span className="text-white font-bold">{session.funcionario?.nome || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Abertura:</span>
                    <span className="text-white">{session.data_hora ? format(new Date(session.data_hora), 'HH:mm') : '-'}</span>
                  </div>
                  <div className="border-t border-gray-600 pt-2 flex justify-between">
                    <span className="text-gray-400">Saldo Inicial:</span>
                    <span className="text-white">R$ {Number(session.saldo_inicial).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Vendas (Dia):</span>
                    <span className="text-[#00d084]">R$ {totalVendas.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Suprimentos (Dia):</span>
                    <span className="text-[#00d084]">R$ {Number(opsSummary.suprimentos || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Retiradas (Dia):</span>
                    <span className="text-red-400">R$ {Number(opsSummary.retiradas || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-base pt-1">
                    <span className="text-white">Saldo Esperado (Dia):</span>
                    <span className="text-[#00d084]">R$ {saldoEsperadoDia.toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-[#2d3e52] rounded p-4 space-y-3 text-sm border border-gray-600">
                  <div className="text-xs text-gray-400 uppercase font-bold">Detalhamento por Pagamento</div>
                  {loadingPayments ? (
                    <div className="text-gray-400 text-sm">Carregando...</div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <PaymentItem label="Dinheiro" value={paymentSummary.dinheiro} color="text-[#00d084]" />
                      <PaymentItem label="Pix" value={paymentSummary.pix} color="text-[#3B82F6]" />
                      <PaymentItem label="QR Code" value={paymentSummary.qrcode} color="text-sky-300" />
                      <PaymentItem label="Debito" value={paymentSummary.debito} color="text-[#8B5CF6]" />
                      <PaymentItem label="Credito" value={paymentSummary.credito} color="text-[#F97316]" />
                      <PaymentItem label="Fiado" value={paymentSummary.fiado} color="text-[#8B5CF6]" />
                      <PaymentItem label="Consumo" value={paymentSummary.consumo} color="text-[#F97316]" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block uppercase font-bold">Saldo Final (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={saldoFinal}
                    onChange={(e) => setSaldoFinal(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#00d084] focus:outline-none text-lg font-mono"
                  />
                </div>

                <CashDenominationCounter
                  onTotalChange={handleCounterTotalChange}
                  resetSignal={counterResetSignal}
                />

                <div className="bg-[#2d3e52] rounded p-3 text-sm border border-gray-600 flex justify-between items-center">
                  <span className="text-gray-400">Saldo apos fechamento</span>
                  <span className={`font-mono font-bold ${saldoFinalPreview < 0 ? 'text-[#EF4444]' : 'text-white'}`}>
                    R$ {saldoFinalPreview.toFixed(2)}
                  </span>
                </div>

                {saldoFinalPreview < 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2">
                    Atencao: o saldo ficara negativo.
                  </div>
                )}

                <div className={`text-center p-2 rounded ${diferenca >= 0 ? 'bg-[#00d084]/10 text-[#00d084]' : 'bg-red-500/10 text-red-500'}`}>
                  <span className="text-xs font-bold uppercase block">Diferenca</span>
                  <span className="font-mono font-bold text-lg">
                    {diferenca > 0 ? '+' : ''}R$ {diferenca.toFixed(2)}
                  </span>
                </div>

                <div>
                  <label className="text-xs text-gray-400 mb-1 block uppercase font-bold">Observacoes</label>
                  <textarea
                    rows="5"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="w-full bg-[#2d3e52] border border-gray-600 rounded px-3 py-2 text-white resize-none focus:border-[#00d084] focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-2">
              <Button
                type="button"
                onClick={onClose}
                className="bg-gray-700 hover:bg-gray-600 text-white border border-gray-600"
              >
                CANCELAR
              </Button>
              <Button
                type="submit"
                className="bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-500/20"
              >
                FECHAR CAIXA
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const PaymentItem = ({ label, value, color }) => (
  <div className="bg-[#1f2a3a] rounded px-3 py-2 border border-gray-700 flex items-center justify-between">
    <span className="text-[10px] uppercase text-gray-400 font-bold">{label}</span>
    <span className={`font-mono font-bold ${color || 'text-white'}`}>
      R$ {Number(value || 0).toFixed(2)}
    </span>
  </div>
);

export default CloseCashierModal;
