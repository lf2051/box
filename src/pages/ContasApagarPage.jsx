import React, { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { Search, Plus, Edit, Trash2, CheckCircle, AlertCircle, XCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const ContasApagarPage = () => {
  const [contas, setContas] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    descricao: '',
    fornecedor: '',
    data_vencimento: '',
    valor: '',
    observacoes: '',
    status: 'pendente'
  });

  useEffect(() => {
    if (user) {
      loadContas();
      const subscription = supabase
        .channel('contas_pagar_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contas_pagar', filter: `user_id=eq.${user.id}` }, () => {
          loadContas();
        })
        .subscribe();
      return () => { subscription.unsubscribe(); };
    }
  }, [user]);

  const loadContas = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contas_pagar')
        .select('*')
        .eq('user_id', user.id)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      setContas(data || []);
    } catch (error) {
      toast({ title: 'Erro ao carregar contas', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const parseLocalDate = (dateStr, endOfDay = false) => {
    if (!dateStr) return null;
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
    const [year, month, day] = parts;
    return new Date(
      year,
      month - 1,
      day,
      endOfDay ? 23 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 59 : 0,
      endOfDay ? 999 : 0
    );
  };

  const formatDateBr = (dateStr) => {
    if (!dateStr) return '-';
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return String(dateStr);
    const [year, month, day] = parts;
    if (!year || !month || !day) return String(dateStr);
    return `${day}/${month}/${year}`;
  };
  const reminders = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;

    const alertDays = new Set([7, 3, 1, 0]);
    const pending = (contas || []).filter((c) => c.status !== 'pago' && c.data_vencimento);

    const mapped = pending.map((conta) => {
      const due = parseLocalDate(conta.data_vencimento, false);
      if (!due) return null;
      const diff = Math.round((due.getTime() - todayStart.getTime()) / msPerDay);
      if (!alertDays.has(diff)) return null;
      return {
        ...conta,
        diasRestantes: diff
      };
    }).filter(Boolean);

    return mapped.sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [contas]);

  const getTargetCaixa = async () => {
    const { data: openCaixa } = await supabase
      .from('caixas')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'aberto')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return openCaixa || null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData, user_id: user.id };
      
      if (editingId) {
        const { error } = await supabase.from('contas_pagar').update(payload).eq('id', editingId);
        if (error) throw error;
        toast({ title: 'Conta atualizada com sucesso!' });
      } else {
        const { error } = await supabase.from('contas_pagar').insert([payload]);
        if (error) throw error;
        toast({ title: 'Conta cadastrada com sucesso!' });
      }
      resetForm();
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = (conta) => {
    setFormData({
      descricao: conta.descricao,
      fornecedor: conta.fornecedor || '',
      data_vencimento: conta.data_vencimento,
      valor: conta.valor,
      observacoes: conta.observacoes || '',
      status: conta.status
    });
    setEditingId(conta.id);
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Deseja realmente excluir esta conta?')) {
      try {
        const { error } = await supabase.from('contas_pagar').delete().eq('id', id);
        if (error) throw error;
        toast({ title: 'Conta excluída com sucesso!' });
      } catch (error) {
         toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      }
    }
  };

  const handleMarkAsPaid = async (conta) => {
    try {
      const now = new Date().toISOString();
      const valor = Number(conta.valor) || 0;
      if (valor <= 0) {
        toast({
          title: 'Valor invalido',
          description: 'A conta deve ter valor maior que zero para ser marcada como paga.',
          variant: 'destructive'
        });
        return;
      }

      const caixa = await getTargetCaixa();
      const saldoAnterior = Number(caixa?.saldo_atual || 0);
      const semBaixaNoCaixa = !caixa || saldoAnterior < valor;
      const saldoNovo = saldoAnterior - valor;

      const updatePayload = { status: 'pago', data_pagamento: now };
      if (semBaixaNoCaixa) {
        const motivoSemBaixa = !caixa
          ? 'Caixa fechado'
          : `Saldo insuficiente (saldo: R$ ${saldoAnterior.toFixed(2)}, valor: R$ ${valor.toFixed(2)})`;
        const nota = `[${now}] Pago sem baixa no caixa - ${motivoSemBaixa}.`;
        updatePayload.observacoes = conta?.observacoes ? `${conta.observacoes} | ${nota}` : nota;
      }

      const { error: updateError } = await supabase
        .from('contas_pagar')
        .update(updatePayload)
        .eq('id', conta.id);
      if (updateError) throw updateError;

      if (semBaixaNoCaixa) {
        const descricaoSemBaixa = !caixa
          ? 'Conta marcada como paga. Caixa fechado, sem baixa no caixa.'
          : `Conta marcada como paga sem baixa no caixa. Saldo atual: R$ ${saldoAnterior.toFixed(2)}.`;
        toast({ title: 'Conta marcada como paga', description: descricaoSemBaixa });
        return;
      }

      const { data: moveInserted, error: moveError } = await supabase
        .from('caixa_movimentos')
        .insert([{
        user_id: user.id,
        caixa_id: caixa.id,
        tipo: 'retirada',
        valor,
        descricao: `Conta paga: ${conta.descricao}`,
        motivo: 'conta_pagar',
        saldo_anterior: saldoAnterior,
        saldo_novo: saldoNovo,
        data_movimentacao: now
        }])
        .select('id')
        .single();
      if (moveError) throw moveError;

      const { error: rpcError } = await supabase.rpc('decrement_caixa_saldo', {
        p_caixa_id: caixa.id,
        p_valor: valor,
        p_tipo: 'retirada'
      });
      if (rpcError) {
        const msg = String(rpcError?.message || '').toLowerCase();
        const details = String(rpcError?.details || '').toLowerCase();
        const checkSaldoError =
          String(rpcError?.code || '') === '23514' ||
          msg.includes('check_caixa_saldo_positivo') ||
          details.includes('check_caixa_saldo_positivo');
        if (checkSaldoError) {
          if (moveInserted?.id) {
            await supabase.from('caixa_movimentos').delete().eq('id', moveInserted.id);
          }

          const nota = `[${now}] Pago sem baixa no caixa - Saldo insuficiente em concorrencia (saldo: R$ ${saldoAnterior.toFixed(2)}, valor: R$ ${valor.toFixed(2)}).`;
          await supabase
            .from('contas_pagar')
            .update({ observacoes: conta?.observacoes ? `${conta.observacoes} | ${nota}` : nota })
            .eq('id', conta.id);

          toast({
            title: 'Conta marcada como paga',
            description: `Sem baixa no caixa por saldo insuficiente. Saldo: R$ ${saldoAnterior.toFixed(2)}.`,
          });
          return;
        }
        const { error: updateCaixaError } = await supabase
          .from('caixas')
          .update({
            saldo_atual: saldoNovo,
            total_retiradas: (caixa.total_retiradas || 0) + valor
          })
          .eq('id', caixa.id);
        if (updateCaixaError) throw updateCaixaError;
      }
      toast({ title: 'Conta marcada como paga e caixa atualizado!' });
    } catch (error) {
      await supabase
        .from('contas_pagar')
        .update({ status: 'pendente', data_pagamento: null })
        .eq('id', conta.id);
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setFormData({
      descricao: '',
      fornecedor: '',
      data_vencimento: '',
      valor: '',
      observacoes: '',
      status: 'pendente'
    });
    setEditingId(null);
    setIsFormOpen(false);
  };

  const today = new Date().toISOString().split('T')[0];
  
  const totalPagar = contas
    .filter(c => c.status !== 'pago')
    .reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);

  const contasVencidas = contas.filter(c => 
    c.status !== 'pago' && c.data_vencimento < today
  ).length;

  const contasAVencer = contas.filter(c => 
    c.status !== 'pago' && c.data_vencimento >= today
  ).length;

  const totalPago = contas
    .filter(c => c.status === 'pago')
    .reduce((acc, curr) => acc + (parseFloat(curr.valor) || 0), 0);

  const filteredContas = contas.filter(c => {
    const matchesSearch = 
      c.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.fornecedor && c.fornecedor.toLowerCase().includes(searchTerm.toLowerCase()));
    
    let matchesFilter = true;
    if (activeFilter === 'Pendente') matchesFilter = c.status === 'pendente' && c.data_vencimento >= today;
    if (activeFilter === 'Vencido') matchesFilter = c.status !== 'pago' && c.data_vencimento < today;
    if (activeFilter === 'Pago') matchesFilter = c.status === 'pago';

    return matchesSearch && matchesFilter;
  });

  const getStatusBadge = (conta) => {
    if (conta.status === 'pago') return <span className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--layout-accent)]/20 text-[var(--layout-accent)]">PAGO</span>;
    if (conta.data_vencimento < today) return <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/20 text-red-400">VENCIDO</span>;
    return <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400">PENDENTE</span>;
  };

  return (
    <div className="p-4 sm:p-6 animate-in fade-in duration-500">
      <Helmet>
        <title>Contas a Pagar - Dashboard</title>
      </Helmet>

      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Contas a Pagar</h1>
        <p className="text-[var(--layout-text-muted)]">Gestão financeira de saídas</p>
      </div>
      {reminders.length > 0 && (
        <div className="bg-gradient-to-br from-yellow-600/15 to-yellow-900/20 border border-yellow-500/30 rounded-xl p-4 sm:p-5 shadow-lg backdrop-blur-sm mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-yellow-500/20 p-2 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-300" />
            </div>
            <div>
              <p className="text-yellow-200 font-bold uppercase text-xs tracking-wider">Lembretes de Vencimento</p>
              <p className="text-yellow-100 text-sm">Contas que vencem em 7, 3, 1 dia ou hoje.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {reminders.map((conta) => (
              <div key={conta.id} className="bg-black/20 border border-yellow-500/20 rounded-lg p-3 flex items-center justify-between">
                <div>
                  <p className="text-white text-sm font-bold">{conta.descricao}</p>
                  <p className="text-[var(--layout-text-muted)] text-xs">
                    Vencimento: {formatDateBr(conta.data_vencimento)}
                  </p>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-500/20 text-yellow-200">
                  {conta.diasRestantes === 0
                    ? 'Vence hoje'
                    : `Em ${conta.diasRestantes} dia${conta.diasRestantes === 1 ? '' : 's'}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-[var(--layout-surface-2)] p-4 sm:p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Total a Pagar</p>
            <h3 className="text-2xl font-bold text-white mt-1">R$ {totalPagar.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-red-500/20 rounded-full">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-[var(--layout-surface-2)] p-4 sm:p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Contas Vencidas</p>
            <h3 className="text-2xl font-bold text-white mt-1">{contasVencidas}</h3>
          </div>
          <div className="p-3 bg-red-500/20 rounded-full">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-[var(--layout-surface-2)] p-4 sm:p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Contas a Vencer</p>
            <h3 className="text-2xl font-bold text-white mt-1">{contasAVencer}</h3>
          </div>
          <div className="p-3 bg-yellow-500/20 rounded-full">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-[var(--layout-surface-2)] p-4 sm:p-6 rounded-lg shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[var(--layout-text-muted)] text-sm font-medium uppercase">Total Pago</p>
            <h3 className="text-2xl font-bold text-[var(--layout-accent)] mt-1">R$ {totalPago.toFixed(2)}</h3>
          </div>
          <div className="p-3 bg-[var(--layout-accent)]/20 rounded-full">
            <CheckCircle className="w-8 h-8 text-[var(--layout-accent)]" />
          </div>
        </div>
      </div>

      <div className="bg-[var(--layout-surface-2)] rounded-lg p-4 sm:p-6 shadow-lg border border-[var(--layout-border)]">
        <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between items-center">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--layout-text-muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por descrição ou fornecedor..."
              className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg pl-10 pr-4 py-2 text-white placeholder-[var(--layout-text-muted)] focus:border-[var(--layout-accent)] focus:outline-none"
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
             {['Todos', 'Pendente', 'Vencido', 'Pago'].map((filter) => (
              <Button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                variant={activeFilter === filter ? 'default' : 'outline'}
                className={`whitespace-nowrap ${
                  activeFilter === filter 
                    ? 'bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white border-transparent' 
                    : 'bg-transparent border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:text-white hover:bg-[var(--layout-bg)]'
                }`}
              >
                {filter}
              </Button>
            ))}
            <Button 
              onClick={() => setIsFormOpen(true)}
              className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white whitespace-nowrap ml-0 md:ml-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nova Conta
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--layout-border)]">
                <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase">Descrição</th>
                <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)] uppercase">Fornecedor</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase">Vencimento</th>
                <th className="py-3 px-4 text-right text-xs font-bold text-[var(--layout-text-muted)] uppercase">Valor</th>
                <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)] uppercase">Status</th>
                <th className="py-3 px-4 text-right text-xs font-bold text-[var(--layout-text-muted)] uppercase">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredContas.map((conta) => (
                <tr key={conta.id} className="hover:bg-[var(--layout-border)] transition-colors">
                  <td className="py-3 px-4 text-white font-medium">{conta.descricao}</td>
                  <td className="py-3 px-4 text-[var(--layout-text-muted)]">{conta.fornecedor}</td>
                  <td className="py-3 px-4 text-center text-[var(--layout-text-muted)]">
                    {formatDateBr(conta.data_vencimento)}
                  </td>
                  <td className="py-3 px-4 text-right text-white font-bold">
                    R$ {parseFloat(conta.valor).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {getStatusBadge(conta)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex justify-end gap-2">
                      {conta.status !== 'pago' && (
                        <button 
                          onClick={() => handleMarkAsPaid(conta)}
                          title="Marcar como Pago"
                          className="p-1 text-[var(--layout-accent)] hover:bg-[var(--layout-accent)]/10 rounded transition-colors"
                        >
                          <CheckCircle className="w-5 h-5" />
                        </button>
                      )}
                      <button 
                        onClick={() => handleEdit(conta)}
                        title="Editar"
                        className="p-1 text-blue-400 hover:bg-blue-400/10 rounded transition-colors"
                      >
                        <Edit className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(conta.id)}
                        title="Excluir"
                        className="p-1 text-red-400 hover:bg-red-400/10 rounded transition-colors"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredContas.length === 0 && (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-[var(--layout-text-muted)]">
                    Nenhuma conta encontrada
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--layout-surface-2)] rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto border border-[var(--layout-border)] shadow-xl">
            <div className="p-4 sm:p-6 border-b border-[var(--layout-border)] flex justify-between items-center">
              <h2 className="text-xl font-bold text-white">
                {editingId ? 'Editar Conta' : 'Nova Conta a Pagar'}
              </h2>
              <button onClick={resetForm} className="text-[var(--layout-text-muted)] hover:text-white">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Descrição *</label>
                <input
                  type="text"
                  required
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Fornecedor *</label>
                <input
                  type="text"
                  required
                  value={formData.fornecedor}
                  onChange={(e) => setFormData({ ...formData, fornecedor: e.target.value })}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Vencimento *</label>
                  <input
                    type="date"
                    required
                    value={formData.data_vencimento}
                    onChange={(e) => setFormData({ ...formData, data_vencimento: e.target.value })}
                    className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Valor (R$) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={formData.valor}
                    onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                    className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--layout-text-muted)] text-sm font-medium mb-2">Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg px-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none h-24 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  onClick={resetForm}
                  variant="outline"
                  className="flex-1 bg-transparent border-[var(--layout-border)] text-white hover:bg-gray-700"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white"
                >
                  {editingId ? 'Atualizar' : 'Salvar'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContasApagarPage;







