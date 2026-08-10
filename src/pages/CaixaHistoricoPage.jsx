import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Calendar, Filter, Lock, RefreshCw, Unlock, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import AdminPasswordModal from '@/components/AdminPasswordModal';

const typeOptions = [
  { value: 'abertura', label: 'Abertura' },
  { value: 'fechamento', label: 'Fechamento' },
  { value: 'suprimento', label: 'Suprimento' },
  { value: 'retirada', label: 'Retirada' },
  { value: 'venda', label: 'Venda' }
];

const typeLabelMap = {
  abertura: 'Abertura',
  fechamento: 'Fechamento',
  suprimento: 'Suprimento',
  retirada: 'Retirada',
  venda: 'Venda'
};

const CaixaHistoricoPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [movimentacoes, setMovimentacoes] = useState([]);
  const [movimentacoesCaixa, setMovimentacoesCaixa] = useState([]);
  const [selectedTypes, setSelectedTypes] = useState(typeOptions.map((t) => t.value));
  const [operatorFilter, setOperatorFilter] = useState('all');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [saldoAtual, setSaldoAtual] = useState(0);
  const [saldoAtualLabel, setSaldoAtualLabel] = useState('último fechado');
  const [saldoAtualAtualizadoEm, setSaldoAtualAtualizadoEm] = useState(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatCurrency = (val) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  const formatMaybeCurrency = (val) => (val == null ? '-' : formatCurrency(val));

  const totalAberturas = movimentacoesCaixa.filter((m) => m.tipo_normalizado === 'abertura').length;
  const totalFechamentos = movimentacoesCaixa.filter((m) => m.tipo_normalizado === 'fechamento').length;
  const totalSuprimentos = movimentacoes
    .filter((m) => m.tipo_normalizado === 'suprimento' && m.source === 'movimento')
    .reduce((sum, m) => sum + Math.abs(Number(m.valor_bruto ?? m.valor_exibido ?? 0) || 0), 0);
  const totalRetiradas = movimentacoes
    .filter((m) => m.tipo_normalizado === 'retirada' && m.source === 'movimento')
    .reduce((sum, m) => sum + Math.abs(Number(m.valor_bruto ?? m.valor_exibido ?? 0) || 0), 0);
  const somaSaldoInicial = movimentacoesCaixa.reduce((sum, m) => sum + (Number(m.saldo_inicial) || 0), 0);
  const somaSaldoFinal = movimentacoesCaixa.reduce((sum, m) => sum + (m.saldo_final == null ? 0 : Number(m.saldo_final) || 0), 0);

  const normalizeTipo = (value, source, saldoInicial, saldoFinal, valor) => {
    const v = String(value || '').toLowerCase();
    if (typeLabelMap[v]) return v;

    if (source === 'caixa') {
      return saldoFinal == null ? 'abertura' : 'fechamento';
    }

    const ant = Number(saldoInicial ?? 0);
    const novo = Number(saldoFinal ?? 0);
    if (!Number.isNaN(ant) && !Number.isNaN(novo)) {
      return novo >= ant ? 'suprimento' : 'retirada';
    }
    const val = Number(valor ?? 0);
    return val >= 0 ? 'suprimento' : 'retirada';
  };

  const operatorOptions = useMemo(() => {
    const set = new Set();
    movimentacoes.forEach((m) => {
      if (m.operador) set.add(m.operador);
    });
    return Array.from(set).sort();
  }, [movimentacoes]);

  const filteredMovimentacoes = useMemo(() => {
    let rows = movimentacoes;

    if (selectedTypes.length > 0) {
      rows = rows.filter((m) => selectedTypes.includes(m.tipo_normalizado));
    }

    if (operatorFilter !== 'all') {
      rows = rows.filter((m) => (m.operador || '-') === operatorFilter);
    }

    const minVal = minValue !== '' ? Number(minValue) : null;
    const maxVal = maxValue !== '' ? Number(maxValue) : null;
    if (minVal != null || maxVal != null) {
      rows = rows.filter((m) => {
        if (m.valor_exibido == null && m.valor == null) return false;
        const raw = m.valor_exibido ?? m.valor;
        const v = Math.abs(Number(raw));
        if (Number.isNaN(v)) return false;
        if (minVal != null && v < minVal) return false;
        if (maxVal != null && v > maxVal) return false;
        return true;
      });
    }

    return rows;
  }, [movimentacoes, selectedTypes, operatorFilter, minValue, maxValue]);

  const toggleType = (value) => {
    setSelectedTypes((prev) => {
      if (prev.includes(value)) return prev.filter((t) => t !== value);
      return [...prev, value];
    });
  };

  const selectAllTypes = () => setSelectedTypes(typeOptions.map((t) => t.value));
  const clearTypes = () => setSelectedTypes([]);

  const enrichMovimentosWithOperador = async (rows) => {
    if (!rows || rows.length === 0) return rows || [];
    const ids = Array.from(new Set(rows.map((r) => r.funcionario_id).filter(Boolean)));
    if (ids.length === 0) return rows;

    const { data, error } = await supabase
      .from('funcionarios')
      .select('id, nome')
      .in('id', ids);

    if (error) return rows;

    const nameById = new Map((data || []).map((f) => [f.id, f.nome]));
    return rows.map((r) => ({
      ...r,
      funcionario_nome: r.funcionario_nome || nameById.get(r.funcionario_id) || r.funcionario?.nome || r.operador || r.cashier_name || r.usuario_nome || r.user_name
    }));
  };

  const fetchCaixaMovimentacoes = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      const { data: openCaixa } = await supabase
        .from('caixas')
        .select('id, saldo_atual, status, created_at')
        .eq('user_id', user.id)
        .eq('status', 'aberto')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let caixaTarget = openCaixa || null;
      if (!caixaTarget) {
        const { data: latestCaixa } = await supabase
          .from('caixas')
          .select('id, saldo_atual, status, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        caixaTarget = latestCaixa || null;
      }

      const [caixaRes, movRes, lastMovRes, lastCaixaMovRes] = await Promise.all([
        supabase
          .from('caixa_movimentacoes')
          .select('id, tipo, saldo_inicial, saldo_final, observacoes, data_hora, funcionario:funcionarios(nome)')
          .eq('user_id', user.id)
          .gte('data_hora', start.toISOString())
          .lte('data_hora', end.toISOString())
          .order('data_hora', { ascending: false }),
        supabase
          .from('caixa_movimentos')
          .select('*')
          .eq('user_id', user.id)
          .in('tipo', ['retirada', 'suprimento', 'venda'])
          .gte('data_movimentacao', start.toISOString())
          .lte('data_movimentacao', end.toISOString())
          .order('data_movimentacao', { ascending: false }),
        caixaTarget?.id
          ? supabase
              .from('caixa_movimentos')
              .select('data_movimentacao')
              .eq('user_id', user.id)
              .eq('caixa_id', caixaTarget.id)
              .order('data_movimentacao', { ascending: false })
              .limit(1)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from('caixa_movimentacoes')
          .select('data_hora')
          .eq('user_id', user.id)
          .order('data_hora', { ascending: false })
          .limit(1)
          .maybeSingle()
      ]);

      if (caixaRes.error) throw caixaRes.error;
      if (movRes.error) throw movRes.error;

      const movEnriched = await enrichMovimentosWithOperador(movRes.data || []);

      const caixaItems = (caixaRes.data || []).map((m) => {
        const tipoNormalizado = normalizeTipo(m.tipo, 'caixa', m.saldo_inicial, m.saldo_final, null);
        const valorExibido = tipoNormalizado === 'abertura'
          ? Number(m.saldo_inicial ?? 0)
          : tipoNormalizado === 'fechamento'
            ? Number((m.saldo_final ?? m.saldo_inicial) ?? 0)
            : null;
        return ({
          id: `cx_${m.id}`,
          rawId: m.id,
          tipo: tipoNormalizado,
          tipo_raw: m.tipo,
          tipo_normalizado: tipoNormalizado,
          data_hora: m.data_hora,
          saldo_inicial: m.saldo_inicial,
          saldo_final: m.saldo_final,
          observacoes: m.observacoes,
          funcionario: m.funcionario || null,
          operador: m.funcionario?.nome || null,
          valor: null,
          valor_exibido: Number.isNaN(valorExibido) ? null : valorExibido,
          valor_bruto: null,
          source: 'caixa'
        });
      });

      const movimentoItems = (movEnriched || []).map((m) => {
        const tipoNormalizado = normalizeTipo(m.tipo, 'movimento', m.saldo_anterior, m.saldo_novo, m.valor);
        const baseValor = Number(m.valor ?? 0);
        const signedValor = tipoNormalizado === 'retirada' ? -Math.abs(baseValor) : Math.abs(baseValor);
        return ({
          id: `mov_${m.id}`,
          rawId: m.id,
          caixa_id: m.caixa_id || null,
          tipo: tipoNormalizado,
          tipo_raw: m.tipo,
          tipo_normalizado: tipoNormalizado,
          data_hora: m.data_movimentacao,
          saldo_inicial: m.saldo_anterior,
          saldo_final: m.saldo_novo,
          observacoes: m.descricao || m.motivo,
          funcionario: null,
          operador: m.funcionario_nome || m.operador || m.cashier_name || m.usuario_nome || m.user_name || null,
          valor: m.valor,
          valor_exibido: Number.isNaN(signedValor) ? null : signedValor,
          valor_bruto: m.valor,
          source: 'movimento'
        });
      });

      const merged = [...caixaItems, ...movimentoItems].sort(
        (a, b) => new Date(b.data_hora) - new Date(a.data_hora)
      );

      setMovimentacoesCaixa(caixaItems);
      setMovimentacoes(merged);

      const saldoAtualValue = Number(caixaTarget?.saldo_atual || 0);
      setSaldoAtual(saldoAtualValue);
      setSaldoAtualLabel(caixaTarget?.status === 'aberto' ? 'aberto' : 'último fechado');

      const candidates = [];
      if (lastMovRes?.data?.data_movimentacao) candidates.push(new Date(lastMovRes.data.data_movimentacao));
      if (lastCaixaMovRes?.data?.data_hora) candidates.push(new Date(lastCaixaMovRes.data.data_hora));
      if (caixaTarget?.created_at) candidates.push(new Date(caixaTarget.created_at));
      const lastUpdate = candidates.length > 0 ? new Date(Math.max(...candidates.map((d) => d.getTime()))) : null;
      setSaldoAtualAtualizadoEm(lastUpdate);
    } catch (err) {
      console.error('Erro ao carregar movimentações do caixa:', err);
    } finally {
      setLoading(false);
    }
  };

  const requestDelete = (mov) => {
    const displayTipo = mov.tipo_normalizado || mov.tipo;

    if (mov.source === 'movimento') {
      if (!['retirada', 'suprimento'].includes(displayTipo)) return;
      if (!window.confirm(`Deseja realmente excluir ${typeLabelMap[displayTipo] || displayTipo}? Esta ação é irreversível.`)) {
        return;
      }
      setPendingDelete(mov);
      setPasswordModalOpen(true);
      return;
    }

    if (mov.source !== 'caixa') return;

    const lastOpen = movimentacoesCaixa.find((m) => m.tipo_normalizado === 'abertura');
    const isCurrentOpen = lastOpen && lastOpen.id === mov.rawId;

    if (isCurrentOpen) {
      toast({
        title: 'Ação não permitida',
        description: 'Feche o caixa antes de apagar a última abertura.',
        variant: 'destructive'
      });
      return;
    }

    if (!window.confirm(`Deseja realmente excluir ${typeLabelMap[displayTipo] || displayTipo}? Esta ação é irreversível.`)) {
      return;
    }

    setPendingDelete(mov);
    setPasswordModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!pendingDelete || !user) return;
    setIsDeleting(true);
    try {
      if (pendingDelete.source === 'movimento') {
        const { error } = await supabase
          .from('caixa_movimentos')
          .delete()
          .eq('id', pendingDelete.rawId)
          .eq('user_id', user.id);

        if (error) throw error;

        if (pendingDelete.caixa_id) {
          const { data: caixaAtual, error: caixaError } = await supabase
            .from('caixas')
            .select('id, saldo_atual, total_retiradas, total_suprimentos, total_vendas')
            .eq('id', pendingDelete.caixa_id)
            .single();

          if (!caixaError && caixaAtual) {
            const valor = Math.abs(Number(pendingDelete.valor_bruto ?? pendingDelete.valor ?? 0) || 0);
            const tipo = pendingDelete.tipo_normalizado || pendingDelete.tipo;
            const updates = {};

            if (tipo === 'retirada') {
              updates.saldo_atual = Number(caixaAtual.saldo_atual || 0) + valor;
              updates.total_retiradas = Math.max(0, Number(caixaAtual.total_retiradas || 0) - valor);
            }

            if (tipo === 'suprimento') {
              updates.saldo_atual = Number(caixaAtual.saldo_atual || 0) - valor;
              updates.total_suprimentos = Math.max(0, Number(caixaAtual.total_suprimentos || 0) - valor);
            }

            if (Object.keys(updates).length > 0) {
              await supabase.from('caixas').update(updates).eq('id', caixaAtual.id);
            }
          }
        }
      } else {
        const { error } = await supabase
          .from('caixa_movimentacoes')
          .delete()
          .eq('id', pendingDelete.rawId)
          .eq('user_id', user.id);

        if (error) throw error;
      }

      toast({
        title: 'Movimentação excluída',
        className: 'bg-[#EF4444] text-white border-none'
      });

      setPendingDelete(null);
      await fetchCaixaMovimentacoes();
    } catch (err) {
      console.error('Erro ao excluir movimentações do caixa:', err);
      toast({
        title: 'Erro ao excluir',
        description: err.message || 'Não foi possível excluir a movimentação.',
        variant: 'destructive'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExportCSV = () => {
    const rows = filteredMovimentacoes.map((m) => ({
      data_hora: m.data_hora ? format(new Date(m.data_hora), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-',
      tipo: typeLabelMap[m.tipo_normalizado] || m.tipo || '-',
      operador: m.operador || '-',
      valor: m.valor_exibido == null ? '' : Number(m.valor_exibido).toFixed(2),
      saldo_inicial: m.saldo_inicial == null ? '' : Number(m.saldo_inicial).toFixed(2),
      saldo_final: m.saldo_final == null ? '' : Number(m.saldo_final).toFixed(2),
      observacoes: m.observacoes || ''
    }));

    const header = ['Data/Hora', 'Tipo', 'Operador', 'Valor', 'Saldo Inicial/Anterior', 'Saldo Final/Novo', 'Observações'];
    const csv = [header.join(';')]
      .concat(
        rows.map((r) => [
          r.data_hora,
          r.tipo,
          r.operador,
          r.valor,
          r.saldo_inicial,
          r.saldo_final,
          r.observacoes.replace(/\r?\n/g, ' ')
        ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(';'))
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historico-caixa-${format(new Date(), 'yyyyMMdd-HHmm')}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    const htmlRows = filteredMovimentacoes.map((m) => `
      <tr>
        <td>${m.data_hora ? format(new Date(m.data_hora), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}</td>
        <td>${typeLabelMap[m.tipo_normalizado] || m.tipo || '-'}</td>
        <td>${m.operador || '-'}</td>
        <td>${m.valor_exibido == null ? '-' : formatCurrency(m.valor_exibido)}</td>
        <td>${formatMaybeCurrency(m.saldo_inicial)}</td>
        <td>${formatMaybeCurrency(m.saldo_final)}</td>
        <td>${(m.observacoes || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
      </tr>
    `).join('');

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Histórico de Caixa</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin: 0 0 16px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Histórico de Caixa</h1>
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Tipo</th>
                <th>Operador</th>
                <th>Valor</th>
                <th>Saldo Inicial/Anterior</th>
                <th>Saldo Final/Novo</th>
                <th>Observações</th>
              </tr>
            </thead>
            <tbody>
              ${htmlRows}
            </tbody>
          </table>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  useEffect(() => {
    fetchCaixaMovimentacoes();
  }, [user]);

  return (
    <div className="p-4 sm:p-6 min-h-screen bg-[var(--layout-bg)] animate-in fade-in duration-500">
      <Helmet>
        <title>Caixa - Brasa & Fogão Restaurante</title>
      </Helmet>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Caixa</h1>
          <p className="text-[var(--layout-text-muted)]">Histórico unificado (abertura/fechamento, retiradas, suprimentos e vendas)</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Button
            onClick={handleExportCSV}
            className="bg-[var(--layout-surface-2)] hover:bg-[var(--layout-border)] text-white border border-[var(--layout-border)]"
          >
            Exportar CSV
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-[var(--layout-surface-2)] hover:bg-[var(--layout-border)] text-white border border-[var(--layout-border)]"
          >
            Imprimir
          </Button>
          <Button
            onClick={fetchCaixaMovimentacoes}
            className="bg-[var(--layout-surface-2)] hover:bg-[var(--layout-border)] text-white border border-[var(--layout-border)]"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Atualizar
          </Button>
        </div>
      </div>

      <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)] mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Período</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-2 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-2 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Funcionário</label>
            <select
              value={operatorFilter}
              onChange={(e) => setOperatorFilter(e.target.value)}
              className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-2 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
            >
              <option value="all">Todos</option>
              {operatorOptions.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1">
              <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Valor mínimo</label>
              <input
                type="number"
                inputMode="decimal"
                value={minValue}
                onChange={(e) => setMinValue(e.target.value)}
                className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-2 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
                placeholder="0,00"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-[var(--layout-text-muted)] mb-1 block">Valor máximo</label>
              <input
                type="number"
                inputMode="decimal"
                value={maxValue}
                onChange={(e) => setMaxValue(e.target.value)}
                className="w-full bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded-lg px-2 py-2 text-white text-sm focus:border-[var(--layout-accent)] focus:outline-none"
                placeholder="0,00"
              />
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--layout-text-muted)] uppercase font-bold">Tipos</span>
          {typeOptions.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={selectedTypes.includes(opt.value) ? 'default' : 'outline'}
              size="sm"
              onClick={() => toggleType(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
          <div className="flex items-center gap-2 ml-auto">
            <Button type="button" variant="ghost" size="sm" onClick={selectAllTypes}>Selecionar todos</Button>
            <Button type="button" variant="ghost" size="sm" onClick={clearTypes}>Limpar</Button>
            <Button
              onClick={fetchCaixaMovimentacoes}
              disabled={loading}
              className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white font-bold"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4 mr-2" />}
              Filtrar
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Aberturas</span>
          <div className="text-2xl font-bold text-white mt-1">{totalAberturas}</div>
        </div>
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Fechamentos</span>
          <div className="text-2xl font-bold text-white mt-1">{totalFechamentos}</div>
        </div>
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Total Suprimentos</span>
          <div className="text-2xl font-bold text-[var(--layout-accent)] mt-1">{formatCurrency(totalSuprimentos)}</div>
        </div>
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Total Retiradas</span>
          <div className="text-2xl font-bold text-[#EF4444] mt-1">{formatCurrency(totalRetiradas)}</div>
        </div>
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Total em Caixa ({saldoAtualLabel})</span>
          <div className="text-2xl font-bold text-white mt-1">{formatCurrency(saldoAtual)}</div>
          <div className="text-[10px] text-[var(--layout-text-muted)] mt-1">
            {saldoAtualAtualizadoEm ? `Atualizado em ${format(saldoAtualAtualizadoEm, 'dd/MM/yyyy HH:mm', { locale: ptBR })}` : 'Atualização não disponível'}
          </div>
        </div>
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Saldo Inicial (Soma)</span>
          <div className="text-2xl font-bold text-[var(--layout-accent)] mt-1">{formatCurrency(somaSaldoInicial)}</div>
        </div>
        <div className="bg-[var(--layout-bg)] p-4 rounded-lg border border-[var(--layout-border)]">
          <span className="text-[var(--layout-text-muted)] text-xs uppercase font-bold">Saldo Final (Soma)</span>
          <div className="text-2xl font-bold text-blue-400 mt-1">{formatCurrency(somaSaldoFinal)}</div>
        </div>
      </div>

      {filteredMovimentacoes.length === 0 ? (
        <div className="p-8 text-center bg-[var(--layout-bg)] rounded-lg border border-[var(--layout-border)]">
          <div className="inline-flex items-center justify-center p-4 bg-[var(--layout-surface-2)] rounded-full mb-3">
            <Calendar className="w-6 h-6 text-[var(--layout-text-muted)]" />
          </div>
          <p className="text-[var(--layout-text-muted)]">Nenhuma movimentação encontrada.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--layout-border)] shadow-xl bg-[var(--layout-bg)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-[var(--layout-surface-2)] text-xs uppercase text-[var(--layout-text-muted)] font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4 text-left">Data/Hora</th>
                  <th className="px-6 py-4 text-left">Tipo</th>
                  <th className="px-6 py-4 text-left">Operador</th>
                  <th className="px-6 py-4 text-right">Valor</th>
                  <th className="px-6 py-4 text-right">Saldo Inicial/Anterior</th>
                  <th className="px-6 py-4 text-right">Saldo Final/Novo</th>
                  <th className="px-6 py-4 text-left">Observações</th>
                  <th className="px-6 py-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredMovimentacoes.map((mov) => {
                  const displayTipo = mov.tipo_normalizado || mov.tipo;
                  const displayLabel = typeLabelMap[displayTipo] || mov.tipo || '-';
                  const isOpen = displayTipo === 'abertura';
                  const isClose = displayTipo === 'fechamento';
                  const isCash = mov.source === 'caixa';
                  const isMovimentoDelete = mov.source === 'movimento' && ['retirada', 'suprimento'].includes(displayTipo);
                  const typeColor = isOpen ? 'text-[var(--layout-accent)]' : isClose ? 'text-[#EF4444]' : displayTipo === 'suprimento' ? 'text-[var(--layout-accent)]' : displayTipo === 'retirada' ? 'text-[#EF4444]' : 'text-[#3B82F6]';
                  const typeBg = isOpen ? 'bg-[var(--layout-accent)]/10' : isClose ? 'bg-[#EF4444]/10' : displayTipo === 'suprimento' ? 'bg-[var(--layout-accent)]/10' : displayTipo === 'retirada' ? 'bg-[#EF4444]/10' : 'bg-[#3B82F6]/10';
                  const Icon = isOpen ? Unlock : Lock;

                  return (
                    <tr key={mov.id} className="hover:bg-white/5 transition-colors odd:bg-[var(--layout-surface-2)]/60 even:bg-[var(--layout-bg)]">
                      <td className="px-6 py-4 text-[var(--layout-text-muted)] font-mono whitespace-nowrap">
                        {mov.data_hora ? format(new Date(mov.data_hora), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 font-bold uppercase text-xs px-2.5 py-1 rounded-full ${typeBg} ${typeColor}`}
                          title={mov.tipo_raw ? `Tipo original: ${mov.tipo_raw}` : undefined}
                        >
                          {isCash && <Icon className="w-4 h-4" />}
                          {displayLabel}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-[var(--layout-text-muted)]">
                        {mov.operador || '-'}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-[var(--layout-text-muted)]">
                        {mov.valor_exibido == null ? '-' : formatCurrency(mov.valor_exibido)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-[var(--layout-text-muted)]">
                        {formatMaybeCurrency(mov.saldo_inicial)}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-white font-bold">
                        {formatMaybeCurrency(mov.saldo_final)}
                      </td>
                      <td className="px-6 py-4 text-[var(--layout-text-muted)] max-w-xs truncate" title={mov.observacoes}>
                        {mov.observacoes || '-'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isCash && (displayTipo === 'abertura' || displayTipo === 'fechamento') ? (
                          <button
                            onClick={() => requestDelete(mov)}
                            className="inline-flex items-center justify-center h-8 w-8 rounded border border-red-500/40 text-red-400 hover:bg-red-500/10 disabled:opacity-50"
                            title={`Excluir ${displayLabel}`}
                            disabled={isDeleting}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : isMovimentoDelete ? (
                          <button
                            onClick={() => requestDelete(mov)}
                            className="inline-flex items-center justify-center h-8 w-8 rounded border border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50"
                            title={`Excluir ${displayLabel}`}
                            disabled={isDeleting}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[var(--layout-text-muted)]">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AdminPasswordModal
        isOpen={passwordModalOpen}
        onClose={() => setPasswordModalOpen(false)}
        onConfirm={handleDeleteConfirm}
        actionType="cancel"
        actionLabel={pendingDelete ? `Excluir ${pendingDelete.tipo}` : 'Excluir movimentação'}
      />
    </div>
  );
};

export default CaixaHistoricoPage;
