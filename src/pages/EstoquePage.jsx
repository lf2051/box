import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import {
  Box,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Edit,
  Search,
  X,
  Layers,
  Trash2,
  Loader2,
  ClipboardList,
  ShoppingCart,
  Copy,
  CheckSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import EstoqueCard from '@/components/EstoqueCard';
import { supabase } from '@/lib/customSupabaseClient';
import { deleteProduct, restoreProduct } from '@/services/productService';
import { useAuth } from '@/contexts/AuthContext';
import { useCombos } from '@/hooks/useCombos';

const EstoquePage = () => {
  const [produtos, setProdutos] = useState([]);
  const [filteredProdutos, setFilteredProdutos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [loading, setLoading] = useState(true);
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustData, setAdjustData] = useState({ id: null, nome: '', quantidade: '', observacao: '' });

  const { user } = useAuth();
  const { toast } = useToast();
  const { fetchComboInsumos } = useCombos();

  const [deletingIds, setDeletingIds] = useState([]);

  // New state to store fetched combo details to avoid repetitive fetching
  const [comboDetails, setComboDetails] = useState({});

  // Lista de compras personalizada (baseada em vendas + estoque)
  const [buyListLimit, setBuyListLimit] = useState(100);
  const [buyReportLoading, setBuyReportLoading] = useState(false);
  const [buyCandidates, setBuyCandidates] = useState([]);
  const [buyChecklist, setBuyChecklist] = useState({});
  const [buyQuantities, setBuyQuantities] = useState({});
  const [buyUnitCosts, setBuyUnitCosts] = useState({});
  const [buyMultiplierMode, setBuyMultiplierMode] = useState({});
  const [buyCustomMultiplier, setBuyCustomMultiplier] = useState({});

  useEffect(() => {
    if (user) {
      loadEstoque();
      const subscription = supabase.channel('estoque_changes').on('postgres_changes', {
        event: '*', schema: 'public', table: 'produtos', filter: `user_id=eq.${user.id}`
      }, () => { loadEstoque(); }).subscribe();
      return () => { subscription.unsubscribe(); };
    }
    // listen for completed sales to immediately refresh estoque
    const handler = async (e) => {
      try { await loadEstoque(); } catch (err) { console.error('Error refreshing estoque after sale:', err); }
    };
    window.addEventListener('venda.finalizada', handler);
    return () => { window.removeEventListener('venda.finalizada', handler); };
  }, [user]);

  const loadEstoque = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('produtos').select('*').eq('user_id', user.id).eq('ativo', true).order('descricao', { ascending: true });
      if (error) throw error;
      setProdutos(data || []);

      // Fetch details for combos
      const combos = data.filter(p => p.tipo === 'combo');
      const details = {};
      for (const combo of combos) {
        const insumos = await fetchComboInsumos(combo.id);
        details[combo.id] = insumos;
      }
      setComboDetails(details);
      await refreshBuyReport(data || []);

    } catch (error) {
      console.error(error);
    } finally { setLoading(false); }
  };

  const normalizeListLimit = (value) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 1;
    return Math.max(1, Math.min(1000, Math.floor(parsed)));
  };

  const refreshBuyReport = async (productsData = produtos) => {
    if (!user) return;
    try {
      setBuyReportLoading(true);
      const simpleProducts = (productsData || []).filter((p) => p?.tipo !== 'combo' && p?.ativo !== false);

      const { data: soldItems, error: soldError } = await supabase
        .from('itens_venda')
        .select('produto_id, quantidade, status')
        .eq('user_id', user.id);

      if (soldError) throw soldError;

      const soldByProduct = {};
      (soldItems || []).forEach((item) => {
        if (!item?.produto_id) return;
        if (item?.status && item.status !== 'ativo') return;
        soldByProduct[item.produto_id] = (soldByProduct[item.produto_id] || 0) + (Number(item.quantidade) || 0);
      });

      const candidates = simpleProducts
        .map((product) => {
          const estoque = Number(product?.estoque) || 0;
          const minimo = Math.max(0, Number(product?.estoque_minimo) || 0);
          const vendido = Math.max(0, Number(soldByProduct[product.id]) || 0);
          const valorAtacado = Number(product?.valor_atacado ?? product?.valor_compra) || 0;
          const faltaMinimo = Math.max(minimo - estoque, 0);
          const demandaReposicao = Math.max(Math.ceil(vendido * 0.2) - estoque, 0);
          const sugestaoCompra = Math.max(faltaMinimo, demandaReposicao, estoque <= 0 ? Math.max(1, minimo || 1) : 0);
          const prioridadeScore =
            (faltaMinimo > 0 ? 100000 : 0) +
            (estoque <= 0 ? 50000 : 0) +
            vendido;

          return {
            id: product.id,
            codigo: product.codigo,
            descricao: product.descricao,
            categoria: product.categoria,
            estoque,
            minimo,
            vendido,
            valorAtacado,
            faltaMinimo,
            sugestaoCompra,
            prioridadeScore
          };
        })
        .filter((item) => item.vendido > 0 || item.faltaMinimo > 0 || item.estoque <= 0)
        .sort((a, b) =>
          b.prioridadeScore - a.prioridadeScore ||
          b.vendido - a.vendido ||
          a.descricao.localeCompare(b.descricao)
        );

      const soldRankMap = {};
      [...candidates]
        .sort((a, b) => b.vendido - a.vendido || a.descricao.localeCompare(b.descricao))
        .forEach((item, index) => {
          soldRankMap[item.id] = index + 1;
        });

      const enrichedCandidates = candidates.map((item) => {
        let prioridadeLabel = 'NORMAL';
        if (item.estoque <= 0 && item.faltaMinimo > 0) prioridadeLabel = 'CRITICA';
        else if (item.faltaMinimo > 0 || item.vendido >= 50) prioridadeLabel = 'ALTA';
        else if (item.vendido >= 20) prioridadeLabel = 'MEDIA';

        return {
          ...item,
          soldRank: soldRankMap[item.id] || 9999,
          prioridadeLabel
        };
      });

      setBuyCandidates(enrichedCandidates);

      setBuyChecklist((prev) => {
        const next = {};
        enrichedCandidates.forEach((item) => {
          if (prev[item.id]) next[item.id] = true;
        });
        return next;
      });

      setBuyQuantities((prev) => {
        const next = {};
        enrichedCandidates.forEach((item) => {
          const previousQty = Number(prev[item.id]);
          const fallback = item.sugestaoCompra > 0 ? item.sugestaoCompra : 1;
          next[item.id] = Number.isFinite(previousQty) && previousQty > 0 ? Math.floor(previousQty) : fallback;
        });
        return next;
      });

      setBuyUnitCosts((prev) => {
        const next = {};
        enrichedCandidates.forEach((item) => {
          const previousUnitCost = Number(prev[item.id]);
          const fallback = Number(item.valorAtacado) || 0;
          next[item.id] = Number.isFinite(previousUnitCost) && previousUnitCost >= 0 ? previousUnitCost : fallback;
        });
        return next;
      });

      setBuyMultiplierMode((prev) => {
        const next = {};
        enrichedCandidates.forEach((item) => {
          next[item.id] = prev[item.id] || 'x1';
        });
        return next;
      });

      setBuyCustomMultiplier((prev) => {
        const next = {};
        enrichedCandidates.forEach((item) => {
          const current = Number(prev[item.id]);
          next[item.id] = Number.isFinite(current) && current >= 1 ? Math.floor(current) : 1;
        });
        return next;
      });
    } catch (error) {
      console.error('Erro ao gerar lista de compras:', error);
      toast({
        title: 'Erro ao montar lista de compras',
        description: error.message || 'Nao foi possivel gerar o relatorio de compras.',
        variant: 'destructive'
      });
    } finally {
      setBuyReportLoading(false);
    }
  };

  useEffect(() => {
    let result = produtos;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => p.descricao.toLowerCase().includes(term) || p.codigo.toLowerCase().includes(term) || p.categoria?.toLowerCase().includes(term));
    }
    if (activeFilter !== 'Todos') {
      if (activeFilter === 'Estoque baixo') { result = result.filter(p => p.tipo !== 'combo' && (p.estoque || 0) < (p.estoque_minimo || 0) && (p.estoque || 0) > 0); }
      else if (activeFilter === 'Zerado') { result = result.filter(p => p.tipo !== 'combo' && (p.estoque || 0) <= 0); }
      else if (activeFilter === 'Combos') { result = result.filter(p => p.tipo === 'combo'); }
    }
    setFilteredProdutos(result);
  }, [searchTerm, activeFilter, produtos]);

  const handleAdjustClick = (produto) => {
    if (produto.tipo === 'combo') {
      toast({ title: 'Ajuste nÃ£o permitido', description: 'Combos nÃ£o possuem estoque direto. Ajuste os insumos individualmente.', variant: 'destructive' });
      return;
    }
    setAdjustData({ id: produto.id, nome: produto.descricao, quantidade: produto.estoque, observacao: '' });
    setIsAdjustModalOpen(true);
  };

  const handleAdjustSave = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('produtos').update({ estoque: parseInt(adjustData.quantidade) }).eq('id', adjustData.id);
      if (error) throw error;
      toast({ title: 'Estoque atualizado!' });
      setIsAdjustModalOpen(false);
    } catch (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); }
  };

  const handleDeleteProduto = async (id) => {
    if (!window.confirm('Deseja realmente excluir este produto do estoque?')) return;
    setDeletingIds(prev => [...prev, id]);
    try {
      const previous = await deleteProduct(id, user.id);
      // Optimistically remove from local state to immediately update UI
      setProdutos(prev => prev.filter(p => p.id !== id));

      // Show toast with undo action
      toast({
        title: 'Produto removido (inativo)',
        description: 'Produto marcado como inativo e estoque zerado.',
        action: (
          <Button variant="outline" size="sm" onClick={async () => {
            try {
              await restoreProduct(previous, user.id);
              await loadEstoque();
              toast({ title: 'Restaurado', description: 'Produto restaurado com sucesso.' });
            } catch (e) {
              console.error('Undo restore failed', e);
              toast({ title: 'Erro ao restaurar', description: e.message || e, variant: 'destructive' });
            }
          }}>Desfazer</Button>
        ),
      });

      // Ensure list is refreshed from server too
      loadEstoque();
    } catch (error) {
      console.error('Error deleting product from estoque:', error);
      toast({ title: 'Erro ao excluir', description: error.message || error, variant: 'destructive' });
    } finally {
      // remove id from deletingIds
      setDeletingIds(prev => prev.filter(x => x !== id));
    }
  };

  const totalProdutos = produtos.filter(p => p.tipo !== 'combo').length;
  const estoqueBaixo = produtos.filter(p => p.tipo !== 'combo' && (p.estoque || 0) < (p.estoque_minimo || 0)).length;
  const estoqueZerado = produtos.filter(p => p.tipo !== 'combo' && (p.estoque || 0) <= 0).length;
  const valorTotalEstoque = produtos.filter(p => p.tipo !== 'combo').reduce((acc, curr) => acc + (curr.estoque || 0) * (curr.valor_venda || 0), 0);

  const filters = [
    { label: 'Todos', activeColor: 'bg-[var(--layout-accent)] text-white' },
    { label: 'Estoque baixo', activeColor: 'bg-[#FFA500] text-[var(--layout-bg)]' },
    { label: 'Zerado', activeColor: 'bg-[#EF4444] text-white' },
    { label: 'Combos', activeColor: 'bg-[#3B82F6] text-white' }
  ];

  const effectiveBuyLimit = normalizeListLimit(buyListLimit);
  const displayedBuyList = buyCandidates.slice(0, effectiveBuyLimit);
  const displayedBuyIds = displayedBuyList.map((item) => item.id);

  const resolveMultiplier = (itemId) => {
    const mode = buyMultiplierMode[itemId] || 'x1';
    if (mode === 'x6') return 6;
    if (mode === 'x12') return 12;
    if (mode === 'custom') {
      const custom = Number(buyCustomMultiplier[itemId]);
      return Number.isFinite(custom) && custom >= 1 ? Math.floor(custom) : 1;
    }
    return 1;
  };

  const selectedDisplayedCount = displayedBuyIds.filter((id) => buyChecklist[id]).length;
  const selectedDisplayedUnits = displayedBuyList.reduce((acc, item) => {
    if (!buyChecklist[item.id]) return acc;
    const qty = Number(buyQuantities[item.id]) || 0;
    const multiplier = resolveMultiplier(item.id);
    return acc + (qty * multiplier);
  }, 0);
  const selectedDisplayedCostAtacado = displayedBuyList.reduce((acc, item) => {
    if (!buyChecklist[item.id]) return acc;
    const qty = Number(buyQuantities[item.id]) || 0;
    const multiplier = resolveMultiplier(item.id);
    const finalQty = qty * multiplier;
    const unit = Number(buyUnitCosts[item.id]);
    const unitResolved = Number.isFinite(unit) ? unit : (Number(item.valorAtacado) || 0);
    return acc + (finalQty * unitResolved);
  }, 0);
  const selectedMissingAtacado = displayedBuyList.reduce((acc, item) => {
    if (!buyChecklist[item.id]) return acc;
    const unit = Number(buyUnitCosts[item.id]);
    const unitResolved = Number.isFinite(unit) ? unit : (Number(item.valorAtacado) || 0);
    return acc + (unitResolved <= 0 ? 1 : 0);
  }, 0);
  const topSoldPreview = [...buyCandidates]
    .filter((item) => item.vendido > 0)
    .sort((a, b) => b.vendido - a.vendido || a.descricao.localeCompare(b.descricao))
    .slice(0, 5);
  const allDisplayedSelected = displayedBuyIds.length > 0 && selectedDisplayedCount === displayedBuyIds.length;

  const formatCurrencyBr = (value) =>
    Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const parseMoneyValue = (value) => {
    const normalized = String(value ?? '').replace(',', '.');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, parsed);
  };

  const handleToggleBuyItem = (id) => {
    setBuyChecklist((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleToggleAllDisplayed = (checked) => {
    setBuyChecklist((prev) => {
      const next = { ...prev };
      displayedBuyIds.forEach((id) => {
        next[id] = checked;
      });
      return next;
    });
  };

  const handleBuyQuantityChange = (id, value) => {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
    setBuyQuantities((prev) => ({ ...prev, [id]: next }));
  };

  const handleBuyMultiplierModeChange = (id, mode) => {
    const allowed = ['x1', 'x6', 'x12', 'custom'];
    const resolved = allowed.includes(mode) ? mode : 'x1';
    setBuyMultiplierMode((prev) => ({ ...prev, [id]: resolved }));
  };

  const handleBuyCustomMultiplierChange = (id, value) => {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : 1;
    setBuyCustomMultiplier((prev) => ({ ...prev, [id]: next }));
  };

  const handleBuyUnitCostChange = (id, value) => {
    const next = parseMoneyValue(value);
    setBuyUnitCosts((prev) => ({ ...prev, [id]: next }));
  };

  const handleCopyBuyList = async () => {
    const selectedItems = displayedBuyList.filter((item) => buyChecklist[item.id]);
    if (selectedItems.length === 0) {
      toast({
        title: 'Nada selecionado',
        description: 'Marque itens no checklist para copiar sua lista de compras.',
        variant: 'destructive'
      });
      return;
    }

    const totalEstimado = selectedItems.reduce((acc, item) => {
      const qty = Number(buyQuantities[item.id]) || item.sugestaoCompra || 1;
      const multiplier = resolveMultiplier(item.id);
      const finalQty = qty * multiplier;
      const localUnit = Number(buyUnitCosts[item.id]);
      const unit = Number.isFinite(localUnit) ? localUnit : (Number(item.valorAtacado) || 0);
      return acc + (finalQty * unit);
    }, 0);

    const lines = selectedItems.map((item, index) => {
      const qty = Number(buyQuantities[item.id]) || item.sugestaoCompra || 1;
      const multiplier = resolveMultiplier(item.id);
      const finalQty = qty * multiplier;
      const localUnit = Number(buyUnitCosts[item.id]);
      const unit = Number.isFinite(localUnit) ? localUnit : (Number(item.valorAtacado) || 0);
      const subtotal = finalQty * unit;
      const multLabel = multiplier === 1 ? '1x' : `${multiplier}x`;
      return `${index + 1}. ${item.descricao} (${item.codigo}) - Base: ${qty} - Multiplicador: ${multLabel} - Final: ${finalQty} - Valor Compra: ${formatCurrencyBr(unit)} - Subtotal: ${formatCurrencyBr(subtotal)}`;
    });

    const text = `Lista de Compras (${selectedItems.length} itens)\nTotal estimado (compra): ${formatCurrencyBr(totalEstimado)}\n\n${lines.join('\n')}`;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast({ title: 'Lista copiada', description: 'A lista de compras foi copiada para a area de transferencia.' });
      } else {
        toast({ title: 'Copia indisponivel', description: 'Seu navegador nao liberou o recurso de copia.', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Falha ao copiar', description: error.message || 'Nao foi possivel copiar a lista.', variant: 'destructive' });
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <Helmet> <title>Estoque - Dashboard</title> </Helmet>

      <div> <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Estoque</h1> <p className="text-[var(--layout-text-muted)]">VisÃ£o geral e monitoramento</p> </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <EstoqueCard title="Produtos Simples" value={totalProdutos} icon={Box} color="#3b82f6" />
        <EstoqueCard title="Estoque baixo" value={estoqueBaixo} icon={AlertTriangle} color="#FFA500" />
        <EstoqueCard title="Estoque Zerado" value={estoqueZerado} icon={XCircle} color="#EF4444" />
        <EstoqueCard
          title="Valor em Estoque"
          value={`R$ ${valorTotalEstoque.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={CheckCircle}
          color="var(--layout-accent)"
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 mb-6 justify-between items-center bg-[var(--layout-surface-2)] p-4 rounded-lg border border-[var(--layout-border)]">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--layout-text-muted)]" />
          <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar..." className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded-lg pl-10 pr-4 py-2 text-white focus:border-[var(--layout-accent)] focus:outline-none" />
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto overflow-x-auto">
          {filters.map(filter => <Button key={filter.label} onClick={() => setActiveFilter(filter.label)} variant={activeFilter === filter.label ? 'default' : 'outline'} className={`whitespace-nowrap ${activeFilter === filter.label ? filter.activeColor : 'bg-transparent text-[var(--layout-text-muted)] border-[var(--layout-border)]'}`}> {filter.label} </Button>)}
        </div>
      </div>

      <div className="bg-[var(--layout-bg)] rounded-lg overflow-hidden shadow-xl border border-[var(--layout-border)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] whitespace-nowrap">
            <thead>
              <tr className="bg-[var(--layout-bg)] border-b border-[var(--layout-border)]">
                <th className="py-4 px-6 text-left text-xs font-bold text-[var(--layout-text-muted)]">CÃ“DIGO</th>
                <th className="py-4 px-6 text-left text-xs font-bold text-[var(--layout-text-muted)]">DESCRIÃ‡ÃƒO</th>
                <th className="py-4 px-6 text-left text-xs font-bold text-[var(--layout-text-muted)]">CATEGORIA</th>
                <th className="py-4 px-6 text-center text-xs font-bold text-[var(--layout-text-muted)]">ESTOQUE</th>
                <th className="py-4 px-6 text-center text-xs font-bold text-[var(--layout-text-muted)]">STATUS</th>
                <th className="py-4 px-6 text-right text-xs font-bold text-[var(--layout-text-muted)]">AÃ‡Ã•ES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {filteredProdutos.map(produto => {
                const isCombo = produto.tipo === 'combo';
                const qtd = parseFloat(produto.estoque) || 0;
                const min = parseFloat(produto.estoque_minimo) || 0;

                let badgeClass = 'bg-[var(--layout-accent)] text-[var(--layout-bg)]';
                let statusText = 'OK';

                if (isCombo) {
                  badgeClass = 'bg-blue-600 text-white';
                  statusText = 'COMBO';
                } else if (qtd <= 0) {
                  badgeClass = 'bg-[#EF4444] text-white';
                  statusText = 'ZERADO';
                } else if (qtd < min) {
                  badgeClass = 'bg-[#FFA500] text-[var(--layout-bg)]';
                  statusText = 'BAIXO';
                }

                const insumosList = isCombo && comboDetails[produto.id]
                  ? comboDetails[produto.id].map(i => `${i.produto?.descricao} (${i.quantidade}${i.unidade_medida})`).join(', ')
                  : '';

                return (
                  <tr key={produto.id} className="hover:bg-[var(--layout-surface-2)]/50 transition-colors">
                    <td className="py-4 px-6 text-sm text-[var(--layout-text-muted)] font-mono">{produto.codigo}</td>
                    <td className="py-4 px-6 text-sm text-white font-medium">
                      {produto.descricao}
                      {isCombo && (
                        <div className="text-xs text-[var(--layout-text-muted)] flex flex-col mt-1">
                          <div className="flex items-center mb-1 text-[var(--layout-text-muted)]">
                            <Layers className="w-3 h-3 mr-1" />
                            ContÃ©m:
                          </div>
                          {comboDetails[produto.id] && comboDetails[produto.id].length > 0 ? (
                            comboDetails[produto.id].map(ins => (
                              <div key={ins.id} className="flex justify-between text-xs text-[var(--layout-text-muted)]">
                                <div className="truncate mr-4">{ins.produto?.descricao || 'Insumo'} x{ins.quantidade}{ins.unidade_medida ? ` ${ins.unidade_medida}` : ''}</div>
                                <div className="font-mono">{ins.produto?.estoque ?? 0}</div>
                              </div>
                            ))
                          ) : (
                            <div className="text-xs text-[var(--layout-text-muted)]">{insumosList || 'Carregando insumos...'}</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-[var(--layout-text-muted)]">{produto.categoria}</td>
                    <td className="py-4 px-6 text-sm font-bold text-center text-[var(--layout-accent)]">
                      {isCombo ? (
                        (() => {
                          const insumos = comboDetails[produto.id];
                          if (!insumos || insumos.length === 0) return 'Carregando...';
                          // compute how many full combos can be assembled
                          const availability = insumos.reduce((acc, ins) => {
                            try {
                              const stock = parseFloat(ins.produto?.estoque || 0);
                              const needed = parseFloat(ins.quantidade) || 1;
                              const canMake = Math.floor(stock / needed);
                              return acc === null ? canMake : Math.min(acc, canMake);
                            } catch (e) { return acc === null ? 0 : Math.min(acc, 0); }
                          }, null) ?? 0;
                          return `DisponÃ­vel: ${availability}`;
                        })()
                      ) : qtd}
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className={`px-3 py-1 text-xs font-bold rounded-full ${badgeClass}`}>
                        {statusText}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      {!isCombo && (
                        <Button variant="ghost" size="sm" onClick={() => handleAdjustClick(produto)} className="text-blue-400 hover:text-blue-300 mr-2">
                          <Edit className="w-4 h-4 mr-2" /> Ajustar
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteProduto(produto.id)} className="text-red-400 hover:text-red-300">
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-[var(--layout-bg)] rounded-lg overflow-hidden shadow-xl border border-[var(--layout-border)]">
        <div className="p-4 sm:p-5 border-b border-[var(--layout-border)] flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-[var(--layout-accent)]" />
                Lista de Compras (Checklist)
              </h2>
              <p className="text-sm text-[var(--layout-text-muted)]">
                Relatorio de produtos que mais vendem para repor antes de acabar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs text-[var(--layout-text-muted)] uppercase font-bold">Qtd de Produtos</label>
              <input
                type="number"
                min="1"
                max="1000"
                value={effectiveBuyLimit}
                onChange={(e) => setBuyListLimit(normalizeListLimit(e.target.value))}
                className="w-24 bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-2 py-1 text-white text-sm"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => refreshBuyReport(produtos)}
                className="bg-transparent border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:text-white"
              >
                Atualizar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleToggleAllDisplayed(!allDisplayedSelected)}
                className="bg-transparent border-[var(--layout-border)] text-[var(--layout-text-muted)] hover:text-white"
              >
                <CheckSquare className="w-4 h-4 mr-2" />
                {allDisplayedSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
              </Button>
              <Button
                type="button"
                onClick={handleCopyBuyList}
                className="bg-[var(--layout-accent)] hover:bg-[var(--layout-accent-strong)] text-white"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copiar Lista
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2">
              <p className="text-xs text-[var(--layout-text-muted)] uppercase font-bold">Itens no Relatorio</p>
              <p className="text-white text-lg font-bold">{buyCandidates.length}</p>
            </div>
            <div className="bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2">
              <p className="text-xs text-[var(--layout-text-muted)] uppercase font-bold">Selecionados</p>
              <p className="text-white text-lg font-bold">{selectedDisplayedCount}</p>
            </div>
            <div className="bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2">
              <p className="text-xs text-[var(--layout-text-muted)] uppercase font-bold">Unidades para Comprar</p>
              <p className="text-[var(--layout-accent)] text-lg font-bold flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                {selectedDisplayedUnits}
              </p>
            </div>
            <div className="bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-2">
              <p className="text-xs text-[var(--layout-text-muted)] uppercase font-bold">Gasto Previsto (Compra)</p>
              <p className="text-[var(--layout-accent)] text-lg font-bold">{formatCurrencyBr(selectedDisplayedCostAtacado)}</p>
            </div>
          </div>

          {selectedMissingAtacado > 0 && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded px-3 py-2 text-yellow-200 text-xs">
              {selectedMissingAtacado} item(ns) selecionado(s) sem valor de atacado/compra cadastrado. Esses itens entram com R$ 0,00 no total previsto.
            </div>
          )}

          {topSoldPreview.length > 0 && (
            <div className="bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-3 py-3">
              <p className="text-xs text-[var(--layout-text-muted)] uppercase font-bold mb-2">Mais Vendidos no Relatorio</p>
              <div className="flex flex-wrap gap-2">
                {topSoldPreview.map((item) => (
                  <span key={item.id} className="px-2 py-1 rounded-full text-xs font-bold bg-[var(--layout-accent)]/20 text-[var(--layout-accent)]">
                    #{item.soldRank} {item.descricao} ({item.vendido})
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          {buyReportLoading ? (
            <div className="p-6 text-[var(--layout-text-muted)] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Gerando relatorio de compras...
            </div>
          ) : displayedBuyList.length === 0 ? (
            <div className="p-6 text-[var(--layout-text-muted)]">
              Nenhum item encontrado no relatorio. Tente atualizar apos novas vendas.
            </div>
          ) : (
            <table className="w-full min-w-[1500px] whitespace-nowrap">
              <thead>
                <tr className="bg-[var(--layout-bg)] border-b border-[var(--layout-border)]">
                  <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)]">CHECK</th>
                  <th className="py-3 px-4 text-left text-xs font-bold text-[var(--layout-text-muted)]">PRODUTO</th>
                  <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)]">RANK</th>
                  <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)]">PRIORIDADE</th>
                  <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)]">VENDIDO</th>
                  <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)]">ESTOQUE</th>
                  <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)]">MINIMO</th>
                  <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)]">VALOR COMPRA</th>
                  <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)]">SUGESTAO</th>
                  <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)]">COMPRAR (BASE)</th>
                  <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)]">MULTIPLICADOR CAIXA</th>
                  <th className="py-3 px-4 text-center text-xs font-bold text-[var(--layout-text-muted)]">TOTAL FINAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {displayedBuyList.map((item) => {
                  const critical = item.estoque <= 0 || item.faltaMinimo > 0;
                  const priorityClass =
                    item.prioridadeLabel === 'CRITICA'
                      ? 'bg-[#EF4444] text-white'
                      : item.prioridadeLabel === 'ALTA'
                        ? 'bg-[#F97316] text-white'
                        : item.prioridadeLabel === 'MEDIA'
                          ? 'bg-[#3B82F6] text-white'
                          : 'bg-[var(--layout-border)] text-white';
                  return (
                    <tr key={item.id} className="hover:bg-[var(--layout-surface-2)]/50 transition-colors">
                      <td className="py-3 px-4">
                        <input
                          type="checkbox"
                          checked={Boolean(buyChecklist[item.id])}
                          onChange={() => handleToggleBuyItem(item.id)}
                          className="w-4 h-4 accent-[var(--layout-accent)]"
                        />
                      </td>
                      <td className="py-3 px-4 text-sm text-white">
                        <div className="font-semibold">{item.descricao}</div>
                        <div className="text-xs text-[var(--layout-text-muted)]">{item.codigo} - {item.categoria || 'Sem categoria'}</div>
                      </td>
                      <td className="py-3 px-4 text-center text-sm font-mono text-white">#{item.soldRank}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${priorityClass}`}>
                          {item.prioridadeLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-sm font-mono text-white">{item.vendido}</td>
                      <td className="py-3 px-4 text-center text-sm font-mono text-white">{item.estoque}</td>
                      <td className="py-3 px-4 text-center text-sm font-mono text-[var(--layout-text-muted)]">{item.minimo}</td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={Number.isFinite(Number(buyUnitCosts[item.id])) ? Number(buyUnitCosts[item.id]) : (Number(item.valorAtacado) || 0)}
                          onChange={(e) => handleBuyUnitCostChange(item.id, e.target.value)}
                          className="w-28 bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-2 py-1 text-white text-sm text-center font-mono"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${critical ? 'bg-[#EF4444] text-white' : 'bg-[#3B82F6] text-white'}`}>
                          {item.sugestaoCompra}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <input
                          type="number"
                          min="1"
                          max="99999"
                          value={Number(buyQuantities[item.id]) || 1}
                          onChange={(e) => handleBuyQuantityChange(item.id, e.target.value)}
                          className="w-24 bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-2 py-1 text-white text-sm text-center"
                        />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <select
                            value={buyMultiplierMode[item.id] || 'x1'}
                            onChange={(e) => handleBuyMultiplierModeChange(item.id, e.target.value)}
                            className="w-24 bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-2 py-1 text-white text-sm"
                          >
                            <option value="x1">1x</option>
                            <option value="x6">6x</option>
                            <option value="x12">12x</option>
                            <option value="custom">Custom</option>
                          </select>
                          {(buyMultiplierMode[item.id] || 'x1') === 'custom' && (
                            <input
                              type="number"
                              min="1"
                              max="99999"
                              value={Number(buyCustomMultiplier[item.id]) || 1}
                              onChange={(e) => handleBuyCustomMultiplierChange(item.id, e.target.value)}
                              className="w-20 bg-[var(--layout-surface-2)] border border-[var(--layout-border)] rounded px-2 py-1 text-white text-sm text-center"
                            />
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center text-sm font-mono text-[var(--layout-accent)] font-bold">
                        {(Number(buyQuantities[item.id]) || 1) * resolveMultiplier(item.id)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isAdjustModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--layout-surface-2)] rounded-lg w-full max-w-md p-4 sm:p-6 border border-[var(--layout-border)]">
            <div className="flex justify-between items-center mb-6"> <h2 className="text-xl font-bold text-white">Ajustar Estoque</h2> <button onClick={() => setIsAdjustModalOpen(false)}><X className="w-6 h-6 text-[var(--layout-text-muted)]" /></button> </div>
            <form onSubmit={handleAdjustSave} className="space-y-4">
              <input type="text" disabled value={adjustData.nome} className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded px-3 py-2 text-[var(--layout-text-muted)]" />
              <input type="number" required min="0" value={adjustData.quantidade} onChange={e => setAdjustData({ ...adjustData, quantidade: e.target.value })} className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded px-3 py-2 text-white" placeholder="Nova Quantidade" />
              <textarea value={adjustData.observacao} onChange={e => setAdjustData({ ...adjustData, observacao: e.target.value })} className="w-full bg-[var(--layout-bg)] border border-[var(--layout-border)] rounded px-3 py-2 text-white h-20 resize-none" placeholder="ObservaÃ§Ã£o" />
              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4"> <Button type="button" variant="ghost" onClick={() => setIsAdjustModalOpen(false)} className="text-[var(--layout-text-muted)]">Cancelar</Button> <Button type="submit" className="bg-[var(--layout-accent)] text-white">Salvar</Button> </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default EstoquePage;
