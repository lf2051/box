import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFuncionarios } from '@/hooks/useFuncionarios';
import CashDenominationCounter from '@/components/CashDenominationCounter';

const OpenCashierModal = ({ isOpen, onClose, onConfirm }) => {
  const [funcionarioId, setFuncionarioId] = useState('');
  const [saldoInicial, setSaldoInicial] = useState('0');
  const [observacoes, setObservacoes] = useState('');
  const [counterResetSignal, setCounterResetSignal] = useState(0);
  const [counterDetails, setCounterDetails] = useState(null);
  const [hasCounterData, setHasCounterData] = useState(false);
  const { funcionarios, fetchFuncionarios } = useFuncionarios();

  useEffect(() => {
    if (isOpen) {
      fetchFuncionarios({ status: 'Ativo' });
      setSaldoInicial('0');
      setFuncionarioId('');
      setObservacoes('');
      setCounterResetSignal((prev) => prev + 1);
      setCounterDetails(null);
      setHasCounterData(false);
    }
  }, [isOpen, fetchFuncionarios]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!funcionarioId) return alert('Selecione um funcionario.');
    const saldo = parseFloat(saldoInicial);
    if (isNaN(saldo) || saldo < 0) return alert('Saldo inicial invalido.');

    const baseObs = (observacoes || '').trim();
    const detalhes = hasCounterData ? (counterDetails?.summaryText || '') : '';
    const finalObservacoes = detalhes ? (baseObs ? `${baseObs}\n\n${detalhes}` : detalhes) : baseObs;

    onConfirm(funcionarioId, saldo, finalObservacoes);
  };

  const handleCounterTotalChange = (total, hasAnyCount, details) => {
    setSaldoInicial(total.toFixed(2));
    setHasCounterData(hasAnyCount);
    setCounterDetails(hasAnyCount ? details : null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-3 sm:p-4 backdrop-blur-sm">
      <AnimatePresence>
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-[var(--layout-bg)] rounded-xl border border-[var(--layout-border)] shadow-2xl w-[min(96vw,84rem)] max-h-[92dvh] overflow-hidden flex min-h-0 flex-col"
        >
          <div className="bg-[var(--layout-surface-2)] p-4 sm:p-5 border-b border-[var(--layout-border)] flex justify-between items-center">
            <div className="flex items-center gap-2 text-white font-bold">
              <Lock className="w-5 h-5 text-[var(--layout-accent)]" />
              <span>ABRIR CAIXA</span>
            </div>
            <button onClick={onClose} className="text-[var(--layout-text-muted)] hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex-1 min-h-0 space-y-5 overflow-y-auto p-4 sm:p-6">
            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(22rem,0.92fr)_minmax(28rem,1.08fr)] 2xl:items-start">
              <div className="space-y-5">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-[var(--layout-text-muted)]">Funcionario *</label>
                  <select
                    required
                    value={funcionarioId}
                    onChange={(e) => setFuncionarioId(e.target.value)}
                    className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-surface-2)] px-3 py-3 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    {funcionarios.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nome} ({f.cargo})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-[var(--layout-text-muted)]">Saldo Inicial (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={saldoInicial}
                    onChange={(e) => setSaldoInicial(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-surface-2)] px-3 py-3 text-lg font-mono text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-[var(--layout-text-muted)]">Observacoes</label>
                  <textarea
                    rows="7"
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    className="w-full resize-none rounded-lg border border-[var(--layout-border)] bg-[var(--layout-surface-2)] px-3 py-3 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="min-w-0">
                <CashDenominationCounter
                  onTotalChange={handleCounterTotalChange}
                  resetSignal={counterResetSignal}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2">
              <Button
                type="button"
                onClick={onClose}
                className="h-12 border border-[var(--layout-border)] bg-[var(--layout-surface-2)] text-white hover:border-[var(--layout-accent)] hover:bg-[var(--layout-surface)]"
              >
                CANCELAR
              </Button>
              <Button
                type="submit"
                className="h-12 bg-[var(--layout-accent)] text-[#1b1208] shadow-lg shadow-[var(--layout-accent)]/20 hover:bg-[var(--layout-accent-strong)]"
              >
                ABRIR CAIXA
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default OpenCashierModal;
