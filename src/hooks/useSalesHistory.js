import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';

export const useSalesHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const hasReconciledOrphansRef = useRef(false);

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

  const normalizePaymentMethod = (method) => {
    const raw = (method || '').toString().trim().toLowerCase();
    if (!raw) return null;
    const clean = raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (clean.includes('dinheiro')) return 'dinheiro';
    if (clean.includes('pix')) return 'pix';
    if (clean.includes('qrcode') || clean.includes('qr code') || clean === 'qr' || clean.includes('qr_')) return 'qrcode';
    if (clean.includes('debito')) return 'debito';
    if (clean.includes('credito')) return 'credito';
    if (clean.includes('fiado')) return 'fiado';
    if (clean.includes('consumo')) return 'consumo';
    return clean;
  };

  const isNonCashPayment = (method) => {
    const key = normalizePaymentMethod(method);
    return key === 'fiado' || key === 'consumo';
  };

  const extractSaleTokenFromDescricao = (descricao) => {
    const text = (descricao || '').toString();
    const match = text.match(/venda\s*#\s*([^\s|)]+)/i);
    return match?.[1]?.trim() || null;
  };

  const toDayKey = (value) => {
    const dt = new Date(value || 0);
    if (Number.isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  };

  const applyCaixaDeltasFromRemovedMovements = async (movements) => {
    const movimentosValidos = (movements || []).filter(Boolean);
    if (movimentosValidos.length === 0) return;

    const totalsByCaixa = movimentosValidos.reduce((acc, mov) => {
      const caixaId = mov.caixa_id;
      if (!caixaId) return acc;
      if (!acc[caixaId]) {
        acc[caixaId] = { saldoDelta: 0, vendasDelta: 0 };
      }
      const val = Number(mov?.valor || 0);
      if (mov.tipo === 'venda') {
        acc[caixaId].saldoDelta -= val;
        acc[caixaId].vendasDelta -= val;
      }
      return acc;
    }, {});

    for (const [caixaId, deltas] of Object.entries(totalsByCaixa)) {
      const { data: caixaAtual, error: caixaError } = await supabase
        .from('caixas')
        .select('id, saldo_atual, total_vendas')
        .eq('id', caixaId)
        .single();
      if (caixaError) throw caixaError;
      if (!caixaAtual) continue;

      const nextSaldo = Number(caixaAtual.saldo_atual || 0) + Number(deltas.saldoDelta || 0);
      const nextVendas = Number(caixaAtual.total_vendas || 0) + Number(deltas.vendasDelta || 0);

      const { error: updateError } = await supabase
        .from('caixas')
        .update({
          saldo_atual: nextSaldo,
          total_vendas: nextVendas
        })
        .eq('id', caixaId);
      if (updateError) throw updateError;
    }

    const ids = movimentosValidos.map((m) => m.id);
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const { error: deleteError } = await supabase.from('caixa_movimentos').delete().in('id', chunk);
      if (deleteError) throw deleteError;
    }
  };

  const reconcileOrphanSaleMovements = useCallback(async () => {
    if (!user || hasReconciledOrphansRef.current) return;

    try {
      const { data: vendas, error: vendasError } = await supabase
        .from('vendas')
        .select('id, numero_venda, data_criacao, data_hora')
        .eq('user_id', user.id);
      if (vendasError) throw vendasError;

      const validIds = new Set((vendas || []).map((v) => String(v.id)));
      const validNumbers = new Set(
        (vendas || [])
          .map((v) => v.numero_venda)
          .filter((n) => n !== null && n !== undefined)
          .map((n) => String(n).trim())
      );

      const saleDayCount = new Map();
      const saleDayTime = new Map();
      (vendas || []).forEach((v) => {
        const saleDate = v?.data_criacao || v?.data_hora;
        const day = toDayKey(saleDate);
        if (!day) return;

        const time = new Date(saleDate).getTime();
        const tokens = [String(v.id), v?.numero_venda != null ? String(v.numero_venda).trim() : null].filter(Boolean);
        tokens.forEach((token) => {
          const key = `${token}|${day}`;
          saleDayCount.set(key, (saleDayCount.get(key) || 0) + 1);
          if (!saleDayTime.has(key)) {
            saleDayTime.set(key, time);
          }
        });
      });

      const { data: movs, error: movsError } = await supabase
        .from('caixa_movimentos')
        .select('id, caixa_id, tipo, valor, descricao, data_movimentacao')
        .eq('user_id', user.id)
        .eq('tipo', 'venda')
        .ilike('descricao', 'Venda #%');
      if (movsError) throw movsError;

      const duplicateMovs = [];
      const groups = new Map();
      (movs || []).forEach((mov) => {
        const token = extractSaleTokenFromDescricao(mov?.descricao);
        const day = toDayKey(mov?.data_movimentacao);
        if (!token || !day) return;
        if (!validIds.has(token) && !validNumbers.has(token)) return;
        const valueKey = Number(mov?.valor || 0).toFixed(2);
        const key = `${token}|${day}|${valueKey}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(mov);
      });

      groups.forEach((group, key) => {
        if (!Array.isArray(group) || group.length <= 1) return;
        const [token, day] = key.split('|');
        const saleKey = `${token}|${day}`;
        const saleCount = saleDayCount.get(saleKey) || 0;
        if (saleCount > 1) return;

        let keep = group[0];
        if (saleCount === 1) {
          const saleTs = saleDayTime.get(saleKey);
          if (saleTs) {
            keep = group.slice().sort((a, b) => {
              const at = new Date(a.data_movimentacao || 0).getTime();
              const bt = new Date(b.data_movimentacao || 0).getTime();
              return Math.abs(at - saleTs) - Math.abs(bt - saleTs);
            })[0];
          }
        } else {
          keep = group.slice().sort((a, b) => {
            const at = new Date(a.data_movimentacao || 0).getTime();
            const bt = new Date(b.data_movimentacao || 0).getTime();
            return bt - at;
          })[0];
        }

        group.forEach((mov) => {
          if (mov.id !== keep.id) duplicateMovs.push(mov);
        });
      });

      const orphanMovs = (movs || []).filter((mov) => {
        const tokenRaw = extractSaleTokenFromDescricao(mov?.descricao);
        if (!tokenRaw) return false;

        if (validIds.has(tokenRaw) || validNumbers.has(tokenRaw)) return false;

        const asNum = Number(tokenRaw);
        if (!Number.isNaN(asNum)) {
          const normalizedNum = String(asNum);
          if (validNumbers.has(normalizedNum)) return false;
        }

        return true;
      });

      const movimentosParaRemover = Array.from(
        new Map([...(orphanMovs || []), ...(duplicateMovs || [])].map((m) => [m.id, m])).values()
      );

      if (movimentosParaRemover.length > 0) {
        await applyCaixaDeltasFromRemovedMovements(movimentosParaRemover);
      }

      hasReconciledOrphansRef.current = true;
    } catch (err) {
      console.error('Error reconciling orphan sale movements:', err);
    }
  }, [user]);

  // Fetch sales with comprehensive filtering
  const fetchSalesWithFilters = useCallback(async ({ startDate, endDate, searchTerm, tipoVenda, status }) => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    try {
      await reconcileOrphanSaleMovements();

      let query = supabase
        .from('vendas')
        .select(`
          *,
          cliente:pessoas(nome, telefone),
          vendedor:vendedor_id(nome),
          itens:itens_venda(
            *,
            produto:produtos(descricao, codigo)
          ),
          pagamentos:venda_pagamentos(*)
        `)
        .eq('user_id', user.id)
        .order('data_criacao', { ascending: false });

      // Date Filters (start of day to end of day)
      const start = parseLocalDate(startDate, false);
      const end = parseLocalDate(endDate, true);

      const startIso = start ? start.toISOString() : null;
      const endIso = end ? end.toISOString() : null;

      if (startIso && endIso) {
        query = query.or(`and(data_criacao.gte.${startIso},data_criacao.lte.${endIso}),and(data_hora.gte.${startIso},data_hora.lte.${endIso})`);
      } else if (startIso) {
        query = query.or(`data_criacao.gte.${startIso},data_hora.gte.${startIso}`);
      } else if (endIso) {
        query = query.or(`data_criacao.lte.${endIso},data_hora.lte.${endIso}`);
      }

      // Type Filter
      if (tipoVenda && tipoVenda !== 'todos') {
        query = query.eq('tipo_venda', tipoVenda);
      }

      // Status Filter
      if (status && status !== 'todos') {
         const dbStatus = status === 'completa' ? 'concluido' : status;
         query = query.eq('status', dbStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Search Filter (Client Side for simpler text search on relations)
      let filteredData = data || [];
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        filteredData = filteredData.filter(sale => 
          (sale.numero_venda?.toString().includes(lowerTerm)) ||
          (sale.cliente?.nome?.toLowerCase().includes(lowerTerm)) ||
          (String(sale.id).toLowerCase().includes(lowerTerm))
        );
      }

      setSales(filteredData);
    } catch (err) {
      console.error('Error fetching sales history:', err);
      setError(err.message);
      toast({
        title: 'Erro ao carregar histórico',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast, reconcileOrphanSaleMovements]);

  const updateSale = async (saleId, updates) => {
    if (!user) return;
    try {
      // Validate vendedor_id if present
      if (updates.hasOwnProperty('vendedor_id')) {
        if (updates.vendedor_id === '' || updates.vendedor_id === 'undefined') {
          updates.vendedor_id = null;
        }
        // Additional validation could be done here if we had the list of sellers,
        // but for now we ensure it's at least null if empty to avoid FK violation with empty string
      }

      const { error } = await supabase
        .from('vendas')
        .update(updates)
        .eq('id', saleId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Update local state locally to avoid refetch
      setSales(prev => prev.map(s => s.id === saleId ? { ...s, ...updates } : s));

      toast({
        title: 'Venda atualizada com sucesso',
        className: 'bg-[#00d084] text-white border-none'
      });
      return true;
    } catch (err) {
      console.error('Error updating sale:', err);
      toast({
        title: 'Erro ao atualizar venda',
        description: err.message,
        variant: 'destructive'
      });
      return false;
    }
  };

  const deleteSale = async (saleId) => {
    if (!user) return;
    try {
      let sale = sales.find(s => s.id === saleId);
      if (!sale) {
        const { data: saleData, error: saleError } = await supabase
          .from('vendas')
          .select('id, numero_venda, total, data_criacao, data_hora')
          .eq('id', saleId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (saleError) throw saleError;
        sale = saleData || null;
      }

      let pagamentosDaVenda = Array.isArray(sale?.pagamentos) ? sale.pagamentos : [];
      if (!pagamentosDaVenda.length) {
        const { data: pagamentosData, error: pagamentosError } = await supabase
          .from('venda_pagamentos')
          .select('forma_pagamento, valor')
          .eq('user_id', user.id)
          .eq('venda_id', saleId);
        if (pagamentosError) throw pagamentosError;
        pagamentosDaVenda = pagamentosData || [];
      }

      const cashImpact = pagamentosDaVenda
        .filter((p) => !isNonCashPayment(p?.forma_pagamento))
        .reduce((sum, p) => sum + Number(p?.valor || 0), 0);

      const possibleDescs = [];
      if (sale?.numero_venda) possibleDescs.push(`Venda #${sale.numero_venda}`);
      possibleDescs.push(`Venda #${saleId}`);

      const movimentosParaRemover = [];
      const saleTs = new Date(sale?.data_criacao || sale?.data_hora || new Date()).getTime();
      const saleDay = toDayKey(sale?.data_criacao || sale?.data_hora || new Date());
      const targetValue = cashImpact > 0 ? cashImpact : Number(sale?.total || 0);
      const pickClosestMovement = (rows) => {
        if (!rows || rows.length === 0) return null;
        return rows.slice().sort((a, b) => {
          const at = new Date(a.data_movimentacao || 0).getTime();
          const bt = new Date(b.data_movimentacao || 0).getTime();
          return Math.abs(at - saleTs) - Math.abs(bt - saleTs);
        })[0];
      };

      // 0. Find cash movements tied to this sale by exact description
      if (possibleDescs.length > 0) {
        const likeParts = possibleDescs
          .map((d) => d?.replace(/"/g, '').trim())
          .filter(Boolean)
          .map((d) => `descricao.ilike.${d}%`);

        const { data: movsSale, error: movsSaleError } = await supabase
          .from('caixa_movimentos')
          .select('id, caixa_id, tipo, valor, data_movimentacao')
          .eq('user_id', user.id)
          .eq('tipo', 'venda')
          .or(likeParts.join(','));
        if (movsSaleError) throw movsSaleError;
        if (movsSale && movsSale.length > 0) {
          const sameDay = movsSale.filter((m) => toDayKey(m?.data_movimentacao) === saleDay);
          const sameDayAndValue = sameDay.filter((m) => Math.abs(Number(m?.valor || 0) - targetValue) < 0.01);
          const picked = pickClosestMovement(sameDayAndValue) || pickClosestMovement(sameDay) || pickClosestMovement(movsSale);
          if (picked) movimentosParaRemover.push(picked);
        }
      }

      // 0.1 Fallback: match by day/valor if description didn't match
      if (movimentosParaRemover.length === 0 && sale) {
        const saleDt = new Date(sale.data_criacao || sale.data_hora || new Date());
        const start = new Date(saleDt);
        start.setHours(0, 0, 0, 0);
        const end = new Date(saleDt);
        end.setHours(23, 59, 59, 999);

        let movFallbackQuery = supabase
          .from('caixa_movimentos')
          .select('id, caixa_id, tipo, valor, data_movimentacao')
          .eq('user_id', user.id)
          .eq('tipo', 'venda')
          .gte('data_movimentacao', start.toISOString())
          .lte('data_movimentacao', end.toISOString());

        if (cashImpact > 0) {
          movFallbackQuery = movFallbackQuery.eq('valor', cashImpact);
        } else {
          movFallbackQuery = movFallbackQuery.eq('valor', Number(sale.total || 0));
        }

        const { data: movFallback, error: movFallbackError } = await movFallbackQuery;
        if (movFallbackError) throw movFallbackError;
        if (movFallback && movFallback.length > 0) {
          const picked = pickClosestMovement(movFallback);
          if (picked) movimentosParaRemover.push(picked);
        }
      }

      const movimentosUnicos = Array.from(
        new Map((movimentosParaRemover || []).map((m) => [m.id, m])).values()
      );

      // 0.2 If movements were found, adjust caixa totals before deleting
      if (movimentosUnicos.length > 0) {
        await applyCaixaDeltasFromRemovedMovements(movimentosUnicos);
      }

      // 1. Delete Items
      const { error: itemsError } = await supabase.from('itens_venda').delete().eq('venda_id', saleId);
      if (itemsError) throw itemsError;
      // 2. Delete Payments
      const { error: paymentsError } = await supabase.from('venda_pagamentos').delete().eq('venda_id', saleId);
      if (paymentsError) throw paymentsError;
      // 3. Delete History (if exists)
      const { error: historyError } = await supabase.from('vendas_itens_historico').delete().eq('venda_id', saleId);
      if (historyError) throw historyError;

      // 4. Delete Sale
      const { error } = await supabase
        .from('vendas')
        .delete()
        .eq('id', saleId)
        .eq('user_id', user.id);

      if (error) throw error;

      setSales(prev => prev.filter(s => s.id !== saleId));
      
      toast({
        title: 'Venda excluída com sucesso',
        className: 'bg-[#EF4444] text-white border-none'
      });
      return true;
    } catch (err) {
      console.error('Error deleting sale:', err);
      toast({
        title: 'Erro ao excluir venda',
        description: err.message,
        variant: 'destructive'
      });
      return false;
    }
  };

  const getSalesSummary = () => {
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((acc, curr) => acc + Number(curr.total), 0);
    const totalItems = sales.reduce((acc, curr) => acc + (curr.itens?.length || 0), 0);
    const averageTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

    return { totalSales, totalRevenue, totalItems, averageTicket };
  };

  return {
    sales,
    loading,
    error,
    fetchSalesWithFilters,
    updateSale,
    deleteSale,
    getSalesSummary
  };
};
