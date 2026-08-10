import React, { useEffect, useMemo, useState } from 'react';

const MOEDAS = [0.01, 0.05, 0.1, 0.25, 0.5, 1];
const CEDULAS = [1, 2, 5, 10, 20, 50, 100, 200];

const buildEmptyCounts = () =>
  [...MOEDAS, ...CEDULAS].reduce((acc, value) => {
    acc[value.toFixed(2)] = '0';
    return acc;
  }, {});

const parseCount = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
};

const formatMoney = (value) =>
  Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const buildDetails = (counts, totalAmount, totalUnits) => {
  const moedas = MOEDAS.map((value) => {
    const key = value.toFixed(2);
    const quantity = parseCount(counts[key]);
    return { value, quantity, subtotal: value * quantity };
  });
  const cedulas = CEDULAS.map((value) => {
    const key = value.toFixed(2);
    const quantity = parseCount(counts[key]);
    return { value, quantity, subtotal: value * quantity };
  });
  const moedasTotal = moedas.reduce((sum, item) => sum + item.subtotal, 0);
  const cedulasTotal = cedulas.reduce((sum, item) => sum + item.subtotal, 0);
  const moedasResumo =
    moedas.filter((item) => item.quantity > 0).map((item) => `${formatMoney(item.value)}x${item.quantity}`).join('; ') ||
    'nenhuma';
  const cedulasResumo =
    cedulas.filter((item) => item.quantity > 0).map((item) => `${formatMoney(item.value)}x${item.quantity}`).join('; ') ||
    'nenhuma';

  const summaryText = [
    '[Contagem de Caixa]',
    `Moedas: ${formatMoney(moedasTotal)}`,
    `Cedulas: ${formatMoney(cedulasTotal)}`,
    `Total contado: ${formatMoney(totalAmount)}`,
    `Quantidade total de unidades: ${totalUnits}`,
    `Resumo moedas: ${moedasResumo}`,
    `Resumo cedulas: ${cedulasResumo}`
  ].join('\n');

  return {
    moedas,
    cedulas,
    moedasTotal,
    cedulasTotal,
    summaryText
  };
};

const CashDenominationCounter = ({ onTotalChange, resetSignal = 0 }) => {
  const [counts, setCounts] = useState(buildEmptyCounts);

  useEffect(() => {
    setCounts(buildEmptyCounts());
  }, [resetSignal]);

  const totalAmount = useMemo(
    () =>
      Object.entries(counts).reduce((sum, [denomination, quantity]) => {
        return sum + Number(denomination) * parseCount(quantity);
      }, 0),
    [counts]
  );

  const totalUnits = useMemo(
    () =>
      Object.values(counts).reduce((sum, quantity) => {
        return sum + parseCount(quantity);
      }, 0),
    [counts]
  );

  const details = useMemo(
    () => buildDetails(counts, totalAmount, totalUnits),
    [counts, totalAmount, totalUnits]
  );

  useEffect(() => {
    if (typeof onTotalChange === 'function') {
      onTotalChange(Number(totalAmount.toFixed(2)), totalUnits > 0, details);
    }
  }, [onTotalChange, totalAmount, totalUnits, details]);

  const updateCount = (denomination, nextValue) => {
    setCounts((prev) => ({
      ...prev,
      [denomination]: nextValue
    }));
  };

  const renderRows = (title, values) => (
    <div>
      <div className="mb-1.5 text-sm font-bold text-[var(--layout-text)]">{title}</div>
      <div className="space-y-1.5">
        {values.map((value) => {
          const denomination = value.toFixed(2);
          return (
            <div key={`${title}-${denomination}`} className="flex items-center gap-2">
              <span className="w-24 shrink-0 rounded border border-[var(--layout-border)] bg-[var(--layout-bg)] px-2 py-1.5 text-sm font-medium text-[var(--layout-text)]">
                {formatMoney(value)}
              </span>
              <input
                type="number"
                min="0"
                step="1"
                value={counts[denomination] ?? '0'}
                onChange={(e) => updateCount(denomination, e.target.value)}
                onBlur={(e) => {
                  if (e.target.value === '') updateCount(denomination, '0');
                }}
                className="w-full min-w-0 rounded border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-1.5 font-mono text-white focus:border-[var(--layout-accent)] focus:outline-none"
              />
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="space-y-3 rounded-xl border border-[var(--layout-border)] bg-[var(--layout-surface-2)] p-4 shadow-lg">
      <div className="text-xs text-[var(--layout-text-muted)]">
        Opcional: informe a quantidade de moedas e cedulas para calcular o caixa.
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {renderRows('Moedas', MOEDAS)}
        {renderRows('Cedulas', CEDULAS)}
      </div>
      <div className="flex items-center justify-between rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2">
        <span className="text-xs font-bold uppercase text-[var(--layout-text-muted)]">Total calculado</span>
        <span className="font-mono text-base font-bold text-[var(--layout-accent)]">{formatMoney(totalAmount)}</span>
      </div>
    </div>
  );
};

export default CashDenominationCounter;
