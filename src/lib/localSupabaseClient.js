import catalogoData from '../../catalogo.json';
import bairrosData from '../../bairros.json';

const LOCAL_DB_KEY = 'brasa-fogao-local-db-v1';
const AUTH_STORAGE_KEY = 'brasa-fogao-access';
const LOCAL_USER_ID = '00000000-0000-0000-0000-000000000026';
const CHANGE_EVENT = 'brasa-fogao-local-db-change';

const nowIso = () => new Date().toISOString();
const clone = (value) => JSON.parse(JSON.stringify(value));
const randomId = () =>
  (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function')
    ? globalThis.crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const isBrowser = typeof window !== 'undefined';

const defaultAppInfo = {
  appUrl: '',
  nomeAplicativo: 'Brasa & Fogão Restaurante',
  sourceProdutos: 'produtos_erp',
  destinoPedidos: 'pedidos_delivery',
  cadastroClientes: 'clientes',
  horarioFuncionamento: 'Seg a Dom - 08:00 às 22:00',
  enderecoLoja: 'Brasa & Fogão Restaurante',
  corPrimaria: '#ff8a3d',
  corSecundaria: '#3d2418',
  logoUrl: '',
};

const defaultDeliverySettings = {
  publishAllProducts: true,
  publishedProductIds: [],
  pausedProductIds: [],
  bairros: Array.isArray(bairrosData?.bairros) ? bairrosData.bairros : [],
  appInfo: defaultAppInfo,
  chatbotAi: {
    enabled: false,
    mode: 'fallback',
    provider: 'custom',
    endpoint: '',
    authType: 'bearer',
    headerName: 'Authorization',
    headerValue: '',
    payloadKey: 'message',
    responsePath: '',
    apiKey: '',
    model: '',
    temperature: 0.4,
    maxTokens: 600,
    systemPrompt: '',
  },
  ifood: {
    enabled: false,
    integrationUrl: 'http://localhost:8787',
    clientId: '',
    clientSecret: '',
    merchantId: '',
    lastConnectionAt: '',
    lastConnectionStatus: '',
    lastConnectionMessage: '',
    lastSyncAt: '',
    lastSyncStatus: '',
    lastSyncMessage: '',
  },
  lastOrderNumber: 1000,
};

const baseProducts = (Array.isArray(catalogoData?.itens) ? catalogoData.itens : []).map((item, index) => ({
  id: item.id || `seed-product-${index + 1}`,
  user_id: LOCAL_USER_ID,
  codigo: item.codigo || String(item.id || `P${index + 1}`).slice(0, 12),
  descricao: item.nome || item.descricao || `Produto ${index + 1}`,
  categoria: item.categoria || 'Geral',
  unidade: item.unidade || 'UN',
  valor_venda: Number(item.preco ?? item.valor_venda ?? 0),
  valor_compra: Number(item.valor_compra ?? item.preco ?? 0) * 0.7,
  estoque: Number(item.estoque ?? 0),
  ativo: item.ativo !== false,
  tipo: item.tipo || 'produto',
  created_at: item.created_at || nowIso(),
  updated_at: item.updated_at || nowIso(),
}));

const seedState = () => {
  const timestamp = nowIso();
  return {
    version: 1,
    tables: {
      produtos: baseProducts,
      pessoas: [],
      motoboys: [],
      funcionarios: [
        {
          id: 'local-funcionario-admin',
          user_id: LOCAL_USER_ID,
          nome: 'Administrador Local',
          cargo: 'Caixa',
          status: 'ativo',
          telefone: '',
          created_at: timestamp,
          updated_at: timestamp,
        },
      ],
      vendedores: [],
      caixas: [
        {
          id: 'local-caixa-principal',
          user_id: LOCAL_USER_ID,
          nome: 'Caixa Principal',
          status: 'fechado',
          saldo_inicial: 0,
          saldo_atual: 0,
          total_vendas: 0,
          total_suprimentos: 0,
          total_retiradas: 0,
          created_at: timestamp,
          updated_at: timestamp,
        },
      ],
      caixa_movimentos: [],
      vendas: [],
      venda_pagamentos: [],
      itens_venda: [],
      contas_pagar: [],
      contas_receber: [],
      combo_insumos: [],
      combo_vendas: [],
      vendas_itens_historico: [],
      delivery_settings: [
        {
          id: 'local-delivery-settings',
          user_id: LOCAL_USER_ID,
          settings: clone(defaultDeliverySettings),
          updated_at: timestamp,
        },
      ],
    },
  };
};

const normalizeState = (raw) => {
  const base = seedState();
  const source = raw && typeof raw === 'object' ? raw : {};
  const tables = source.tables && typeof source.tables === 'object' ? source.tables : {};
  const normalized = { ...base, ...source, tables: {} };
  for (const [tableName, fallbackRows] of Object.entries(base.tables)) {
    const rows = Array.isArray(tables[tableName]) ? tables[tableName] : fallbackRows;
    normalized.tables[tableName] = rows.map((row) => ({ ...row }));
  }
  return normalized;
};

const loadState = () => {
  if (!isBrowser) return seedState();
  try {
    const raw = window.localStorage.getItem(LOCAL_DB_KEY);
    if (!raw) {
      const seed = seedState();
      window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(seed));
      return seed;
    }
    return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn('[Local DB] Falha ao ler localStorage, recriando base local.', error);
    const seed = seedState();
    if (isBrowser) {
      window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(seed));
    }
    return seed;
  }
};

const saveState = (state) => {
  if (!isBrowser) return state;
  window.localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(state));
  return state;
};

const getCurrentUserFromStorage = () => {
  if (!isBrowser) return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? { id: LOCAL_USER_ID, email: 'acesso@brasafogao.local' } : null;
  } catch {
    return null;
  }
};

const subscriptions = new Set();

const emitChange = (detail) => {
  const payload = { ...detail, timestamp: nowIso() };
  for (const listener of subscriptions) {
    try {
      listener(payload);
    } catch (error) {
      console.warn('[Local DB] subscription error:', error);
    }
  }
};

const aliasTableName = (table) => {
  if (table === 'caixa_movimentacoes') return 'caixa_movimentos';
  return table;
};

const getTable = (state, table) => state.tables[aliasTableName(table)] || [];

const setTable = (state, table, rows) => {
  state.tables[aliasTableName(table)] = rows;
  if (aliasTableName(table) === 'caixa_movimentos') {
    state.tables.caixa_movimentacoes = rows;
  }
};

const findById = (state, table, id) =>
  getTable(state, table).find((row) => String(row.id) === String(id)) || null;

const getProductById = (state, id) => findById(state, 'produtos', id);

const getClientById = (state, id) => findById(state, 'pessoas', id);

const getFuncionarioById = (state, id) =>
  findById(state, 'funcionarios', id) || findById(state, 'vendedores', id);

const getSalePayments = (state, vendaId) =>
  getTable(state, 'venda_pagamentos')
    .filter((row) => String(row.venda_id) === String(vendaId))
    .map((row) => ({ ...row }));

const getSaleItems = (state, vendaId) =>
  getTable(state, 'itens_venda')
    .filter((row) => String(row.venda_id) === String(vendaId))
    .map((row) => {
      const produto = getProductById(state, row.produto_id || row.produtoId || row.id);
      return {
        ...row,
        produto: produto ? { id: produto.id, descricao: produto.descricao, codigo: produto.codigo, estoque: produto.estoque, tipo: produto.tipo } : null,
      };
    });

const enrichRow = (state, table, row) => {
  const safeRow = { ...row };

  if (table === 'vendas') {
    const cliente = getClientById(state, safeRow.cliente_id);
    const vendedor = safeRow.vendedor_id ? getFuncionarioById(state, safeRow.vendedor_id) : null;
    const items = getSaleItems(state, safeRow.id);
    const pagamentos = getSalePayments(state, safeRow.id);
    return {
      ...safeRow,
      cliente: cliente ? { ...cliente } : safeRow.cliente || null,
      vendedor: vendedor ? { id: vendedor.id, nome: vendedor.nome } : safeRow.vendedor || null,
      itens: items,
      itens_venda: items,
      pagamentos,
    };
  }

  if (table === 'contas_receber') {
    const cliente = getClientById(state, safeRow.cliente_id);
    const venda = safeRow.venda_id ? enrichRow(state, 'vendas', findById(state, 'vendas', safeRow.venda_id) || {}) : null;
    return {
      ...safeRow,
      cliente: cliente ? { ...cliente } : safeRow.cliente || null,
      venda,
    };
  }

  if (table === 'caixa_movimentos') {
    const funcionario = safeRow.funcionario_id ? getFuncionarioById(state, safeRow.funcionario_id) : null;
    return {
      ...safeRow,
      funcionario: funcionario ? { id: funcionario.id, nome: funcionario.nome } : safeRow.funcionario || null,
    };
  }

  if (table === 'combo_insumos') {
    const produto = getProductById(state, safeRow.insumo_id || safeRow.produto_id);
    return {
      ...safeRow,
      produto: produto
        ? { id: produto.id, descricao: produto.descricao, codigo: produto.codigo, estoque: produto.estoque, tipo: produto.tipo }
        : safeRow.produto || null,
    };
  }

  if (table === 'itens_venda') {
    const produto = getProductById(state, safeRow.produto_id || safeRow.id);
    return {
      ...safeRow,
      produto: produto
        ? { id: produto.id, descricao: produto.descricao, codigo: produto.codigo, estoque: produto.estoque, tipo: produto.tipo }
        : safeRow.produto || null,
    };
  }

  return safeRow;
};

const splitTopLevel = (input, delimiter = ',') => {
  const result = [];
  let depth = 0;
  let current = '';
  for (const char of String(input || '')) {
    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(0, depth - 1);
    if (char === delimiter && depth === 0) {
      if (current.trim()) result.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) result.push(current.trim());
  return result;
};

const atomicMatch = (row, clause) => {
  const cleaned = String(clause || '').trim();
  if (!cleaned) return true;

  const match = cleaned.match(/^([^.]+)\.([^.]+)\.(.+)$/);
  if (!match) return true;

  const [, field, operator, rawValue] = match;
  const value = row?.[field];

  const compare = () => {
    const leftNumber = Number(value);
    const rightNumber = Number(rawValue);
    const leftDate = new Date(value);
    const rightDate = new Date(rawValue);
    const bothDates = !Number.isNaN(leftDate.getTime()) && !Number.isNaN(rightDate.getTime());
    const bothNumbers = !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber);

    if (bothDates) {
      return { left: leftDate.getTime(), right: rightDate.getTime() };
    }
    if (bothNumbers) {
      return { left: leftNumber, right: rightNumber };
    }
    return { left: String(value ?? ''), right: String(rawValue ?? '') };
  };

  const { left, right } = compare();

  switch (operator) {
    case 'eq':
      return String(value ?? '') === String(rawValue);
    case 'neq':
      return String(value ?? '') !== String(rawValue);
    case 'lt':
      return left < right;
    case 'lte':
      return left <= right;
    case 'gt':
      return left > right;
    case 'gte':
      return left >= right;
    case 'ilike': {
      const pattern = String(rawValue)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*');
      return new RegExp(`^${pattern}$`, 'i').test(String(value ?? ''));
    }
    case 'in': {
      const list = String(rawValue)
        .replace(/^\(/, '')
        .replace(/\)$/, '')
        .split(',')
        .map((entry) => entry.trim().replace(/^"|"$/g, '').replace(/^'|'$/g, ''));
      return list.some((entry) => String(value ?? '') === entry);
    }
    default:
      return true;
  }
};

const matchesExpression = (row, expression) => {
  const trimmed = String(expression || '').trim();
  if (!trimmed) return true;

  if (trimmed.startsWith('and(') && trimmed.endsWith(')')) {
    const inner = trimmed.slice(4, -1);
    return splitTopLevel(inner).every((clause) => atomicMatch(row, clause));
  }

  if (trimmed.includes(',') && !trimmed.startsWith('http')) {
    return splitTopLevel(trimmed).some((part) => matchesExpression(row, part));
  }

  return atomicMatch(row, trimmed);
};

const compareRows = (a, b, ascending) => {
  const left = a ?? '';
  const right = b ?? '';

  const leftDate = new Date(left);
  const rightDate = new Date(right);
  const bothDates = !Number.isNaN(leftDate.getTime()) && !Number.isNaN(rightDate.getTime());
  if (bothDates) {
    return ascending ? leftDate - rightDate : rightDate - leftDate;
  }

  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const bothNumbers = !Number.isNaN(leftNumber) && !Number.isNaN(rightNumber);
  if (bothNumbers) {
    return ascending ? leftNumber - rightNumber : rightNumber - leftNumber;
  }

  const comparison = String(left).localeCompare(String(right), 'pt-BR', { numeric: true, sensitivity: 'base' });
  return ascending ? comparison : -comparison;
};

const executeRpc = async (state, name, params = {}) => {
  const readProduct = (id) => getProductById(state, id);
  const writeProduct = (id, updater) => {
    const products = getTable(state, 'produtos').map((row) => {
      if (String(row.id) !== String(id)) return row;
      return updater({ ...row });
    });
    setTable(state, 'produtos', products);
    return products.find((row) => String(row.id) === String(id)) || null;
  };

  const readCaixa = (id) => findById(state, 'caixas', id);
  const writeCaixa = (id, updater) => {
    const caixas = getTable(state, 'caixas').map((row) => {
      if (String(row.id) !== String(id)) return row;
      return updater({ ...row });
    });
    setTable(state, 'caixas', caixas);
    return caixas.find((row) => String(row.id) === String(id)) || null;
  };

  if (name === 'decrement_estoque' || name === 'increment_estoque') {
    const productId = params.p_produto_id || params.produto_id || params.id;
    const qty = Number(params.p_quantidade ?? params.quantidade ?? 0);
    if (!productId || !Number.isFinite(qty) || qty <= 0) {
      return { data: null, error: { message: 'Parametros invalidos para alterar estoque.' } };
    }

    const product = readProduct(productId);
    if (!product) {
      return { data: null, error: { message: 'Produto nao encontrado.' } };
    }

    if (name === 'decrement_estoque' && Number(product.estoque || 0) < qty) {
      return { data: null, error: { message: 'Estoque insuficiente.' } };
    }

    const updated = writeProduct(productId, (row) => ({
      ...row,
      estoque: name === 'decrement_estoque'
        ? Number(row.estoque || 0) - qty
        : Number(row.estoque || 0) + qty,
      updated_at: nowIso(),
    }));

    emitChange({ table: 'produtos', action: 'rpc', rows: [updated] });
    return { data: updated, error: null };
  }

  if (name === 'increment_caixa_saldo' || name === 'decrement_caixa_saldo') {
    const caixaId = params.p_caixa_id || params.caixa_id || params.id;
    const valor = Number(params.p_valor ?? params.valor ?? 0);
    const tipo = params.p_tipo || params.tipo || (name === 'decrement_caixa_saldo' ? 'retirada' : 'venda');
    if (!caixaId || !Number.isFinite(valor) || valor < 0) {
      return { data: null, error: { message: 'Parametros invalidos para alterar saldo do caixa.' } };
    }

    const caixa = readCaixa(caixaId);
    if (!caixa) {
      return { data: null, error: { message: 'Caixa nao encontrado.' } };
    }

    if (name === 'decrement_caixa_saldo' && Number(caixa.saldo_atual || 0) < valor) {
      return {
        data: null,
        error: {
          code: '23514',
          message: 'check_caixa_saldo_positivo',
          details: 'check_caixa_saldo_positivo',
        },
      };
    }

    const updated = writeCaixa(caixaId, (row) => {
      const next = { ...row, updated_at: nowIso() };
      if (name === 'increment_caixa_saldo') {
        next.saldo_atual = Number(row.saldo_atual || 0) + valor;
        if (tipo === 'suprimento') {
          next.total_suprimentos = Number(row.total_suprimentos || 0) + valor;
        } else if (tipo === 'venda') {
          next.total_vendas = Number(row.total_vendas || 0) + valor;
        }
      } else {
        next.saldo_atual = Number(row.saldo_atual || 0) - valor;
        next.total_retiradas = Number(row.total_retiradas || 0) + valor;
      }
      return next;
    });

    emitChange({ table: 'caixas', action: 'rpc', rows: [updated] });
    return { data: updated, error: null };
  }

  return { data: null, error: { message: `RPC nao suportado: ${name}` } };
};

class LocalSupabaseQuery {
  constructor(client, table, action = 'select', payload = null) {
    this.client = client;
    this.table = aliasTableName(table);
    this.action = action;
    this.payload = payload;
    this.columns = '*';
    this.filters = [];
    this.orderBy = null;
    this.limitCount = null;
    this.singleMode = null;
    this.onConflict = null;
    this.orExpression = null;
  }

  select(columns = '*') {
    this.columns = columns;
    return this;
  }

  eq(field, value) {
    this.filters.push({ type: 'eq', field, value });
    return this;
  }

  neq(field, value) {
    this.filters.push({ type: 'neq', field, value });
    return this;
  }

  lt(field, value) {
    this.filters.push({ type: 'lt', field, value });
    return this;
  }

  lte(field, value) {
    this.filters.push({ type: 'lte', field, value });
    return this;
  }

  gt(field, value) {
    this.filters.push({ type: 'gt', field, value });
    return this;
  }

  gte(field, value) {
    this.filters.push({ type: 'gte', field, value });
    return this;
  }

  ilike(field, value) {
    this.filters.push({ type: 'ilike', field, value });
    return this;
  }

  in(field, values) {
    this.filters.push({ type: 'in', field, value: values });
    return this;
  }

  or(expression) {
    this.orExpression = expression;
    return this;
  }

  order(field, options = {}) {
    this.orderBy = { field, ascending: options.ascending !== false };
    return this;
  }

  limit(count) {
    this.limitCount = Number(count) || 0;
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybe';
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  insert(values) {
    this.action = 'insert';
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  update(values) {
    this.action = 'update';
    this.payload = values || {};
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(values, options = {}) {
    this.action = 'upsert';
    this.payload = Array.isArray(values) ? values : [values];
    this.onConflict = options.onConflict || null;
    return this;
  }

  async _execute() {
    return this.client._executeQuery(this);
  }

  then(resolve, reject) {
    return this._execute().then(resolve, reject);
  }

  catch(reject) {
    return this.then(undefined, reject);
  }

  finally(callback) {
    return this.then(
      (value) => Promise.resolve(callback()).then(() => value),
      (error) => Promise.resolve(callback()).then(() => {
        throw error;
      }),
    );
  }
}

class LocalSupabaseClient {
  constructor() {
    this._state = normalizeState(loadState());
    this.auth = {
      getUser: async () => ({ data: { user: getCurrentUserFromStorage() }, error: null }),
      getSession: async () => ({ data: { session: getCurrentUserFromStorage() ? { user: getCurrentUserFromStorage() } : null }, error: null }),
    };
  }

  _refreshState() {
    this._state = normalizeState(loadState());
    return this._state;
  }

  _saveState() {
    saveState(this._state);
    return this._state;
  }

  _tableRows(table) {
    return getTable(this._state, table);
  }

  _setTableRows(table, rows) {
    setTable(this._state, table, rows);
    return rows;
  }

  _matchFilters(row, query) {
    const matchesAll = query.filters.every((filter) => {
      const value = row?.[filter.field];
      switch (filter.type) {
        case 'eq':
          return String(value ?? '') === String(filter.value ?? '');
        case 'neq':
          return String(value ?? '') !== String(filter.value ?? '');
        case 'lt':
          return compareRows(value, filter.value, true) < 0;
        case 'lte':
          return compareRows(value, filter.value, true) <= 0;
        case 'gt':
          return compareRows(value, filter.value, false) < 0;
        case 'gte':
          return compareRows(value, filter.value, false) <= 0;
        case 'ilike':
          return atomicMatch({ [filter.field]: value }, `${filter.field}.ilike.${filter.value}`);
        case 'in': {
          const list = Array.isArray(filter.value) ? filter.value : [];
          return list.some((entry) => String(entry ?? '') === String(value ?? ''));
        }
        default:
          return true;
      }
    });

    const matchesOr = query.orExpression ? matchesExpression(row, query.orExpression) : true;
    return matchesAll && matchesOr;
  }

  _applyAugmentation(table, rows) {
    return rows.map((row) => enrichRow(this._state, table, row));
  }

  _applyOrderAndLimit(rows, query) {
    let result = [...rows];
    if (query.orderBy) {
      const { field, ascending } = query.orderBy;
      result.sort((left, right) => compareRows(left?.[field], right?.[field], ascending));
    }
    if (query.limitCount !== null && query.limitCount !== undefined) {
      result = result.slice(0, query.limitCount);
    }
    return result;
  }

  _normalizeInsertRow(table, row) {
    const timestamp = nowIso();
    const next = {
      ...row,
      id: row.id || randomId(),
      created_at: row.created_at || timestamp,
      updated_at: row.updated_at || timestamp,
    };

    if (!next.user_id && table !== 'delivery_settings') {
      next.user_id = LOCAL_USER_ID;
    }

    if (table === 'vendas') {
      const existingNumbers = getTable(this._state, 'vendas')
        .map((entry) => Number(entry.numero_venda))
        .filter((value) => Number.isFinite(value));
      next.numero_venda = next.numero_venda || (existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1);
      next.status = next.status || 'concluido';
      next.data_criacao = next.data_criacao || timestamp;
      next.data_hora = next.data_hora || timestamp;
    }

    if (table === 'caixa_movimentos' || table === 'caixa_movimentacoes') {
      next.data_movimentacao = next.data_movimentacao || timestamp;
    }

    if (table === 'caixa_movimentacoes') {
      next.data_hora = next.data_hora || timestamp;
    }

    if (table === 'caixas') {
      next.saldo_inicial = Number(next.saldo_inicial || 0);
      next.saldo_atual = Number(next.saldo_atual ?? next.saldo_inicial ?? 0);
      next.total_vendas = Number(next.total_vendas || 0);
      next.total_suprimentos = Number(next.total_suprimentos || 0);
      next.total_retiradas = Number(next.total_retiradas || 0);
      next.status = next.status || 'fechado';
    }

    if (table === 'produtos') {
      next.ativo = next.ativo !== false;
      next.estoque = Number(next.estoque || 0);
      next.valor_venda = Number(next.valor_venda ?? next.preco ?? 0);
      next.valor_compra = Number(next.valor_compra ?? 0);
    }

    if (table === 'delivery_settings' && !next.settings) {
      next.settings = clone(defaultDeliverySettings);
    }

    return next;
  }

  _upsertRows(table, rows, onConflict) {
    const conflictFields = String(onConflict || '')
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean);

    const currentRows = [...this._tableRows(table)];
    const upserted = [];

    for (const originalRow of rows) {
      const row = this._normalizeInsertRow(table, originalRow);
      const matchIndex = currentRows.findIndex((existing) => {
        if (conflictFields.length > 0) {
          return conflictFields.every((field) => String(existing?.[field] ?? '') === String(row?.[field] ?? ''));
        }
        return String(existing?.id ?? '') === String(row?.id ?? '');
      });

      if (matchIndex >= 0) {
        currentRows[matchIndex] = {
          ...currentRows[matchIndex],
          ...row,
          updated_at: nowIso(),
        };
        upserted.push(currentRows[matchIndex]);
      } else {
        currentRows.push(row);
        upserted.push(row);
      }
    }

    this._setTableRows(table, currentRows);
    this._saveState();
    emitChange({ table, action: 'upsert', rows: clone(upserted) });
    return upserted;
  }

  async _executeQuery(query) {
    this._refreshState();
    const table = query.table;
    const rows = this._tableRows(table);

    try {
      if (query.action === 'select') {
        let filtered = rows.filter((row) => this._matchFilters(row, query));
        filtered = this._applyOrderAndLimit(filtered, query);
        const augmented = this._applyAugmentation(table, clone(filtered));
        const data = query.singleMode
          ? (augmented.length > 0 ? augmented[0] : null)
          : augmented;
        if (query.singleMode === 'single' && augmented.length !== 1) {
          return { data: augmented[0] || null, error: augmented.length === 0 ? { message: 'No rows found' } : null };
        }
        return { data, error: null };
      }

      if (query.action === 'insert') {
        const insertedRows = query.payload.map((entry) => this._normalizeInsertRow(table, entry));
        const nextRows = [...rows, ...insertedRows];
        this._setTableRows(table, nextRows);
        this._saveState();
        emitChange({ table, action: 'insert', rows: clone(insertedRows) });
        const augmented = this._applyAugmentation(table, clone(insertedRows));
        const data = query.singleMode
          ? (augmented.length > 0 ? augmented[0] : null)
          : augmented;
        return { data, error: null };
      }

      if (query.action === 'upsert') {
        const upserted = this._upsertRows(table, query.payload, query.onConflict);
        const augmented = this._applyAugmentation(table, clone(upserted));
        const data = query.singleMode
          ? (augmented.length > 0 ? augmented[0] : null)
          : augmented;
        return { data, error: null };
      }

      if (query.action === 'update') {
        const updatedRows = [];
        const nextRows = rows.map((row) => {
          if (!this._matchFilters(row, query)) return row;
          const next = {
            ...row,
            ...query.payload,
            updated_at: nowIso(),
          };
          if (table === 'caixas') {
            next.saldo_atual = Number(next.saldo_atual ?? row.saldo_atual ?? 0);
          }
          updatedRows.push(next);
          return next;
        });
        this._setTableRows(table, nextRows);
        this._saveState();
        emitChange({ table, action: 'update', rows: clone(updatedRows) });
        const augmented = this._applyAugmentation(table, clone(updatedRows));
        const data = query.singleMode
          ? (augmented.length > 0 ? augmented[0] : null)
          : augmented;
        return { data, error: null };
      }

      if (query.action === 'delete') {
        const deletedRows = [];
        const remainingRows = rows.filter((row) => {
          const shouldDelete = this._matchFilters(row, query);
          if (shouldDelete) deletedRows.push(row);
          return !shouldDelete;
        });
        this._setTableRows(table, remainingRows);
        this._saveState();
        emitChange({ table, action: 'delete', rows: clone(deletedRows) });
        const augmented = this._applyAugmentation(table, clone(deletedRows));
        const data = query.singleMode
          ? (augmented.length > 0 ? augmented[0] : null)
          : augmented;
        return { data, error: null };
      }

      return { data: null, error: { message: `Operacao desconhecida: ${query.action}` } };
    } catch (error) {
      console.error('[Local DB] query error:', error);
      return { data: null, error: { message: error.message || String(error) } };
    }
  }

  from(table) {
    return new LocalSupabaseQuery(this, table);
  }

  async rpc(name, params = {}) {
    this._refreshState();
    const result = await executeRpc(this._state, name, params);
    if (!result.error) {
      this._saveState();
    }
    return result;
  }

  channel(name) {
    const handlers = [];
    const channel = {
      name,
      on: (_eventName, config, callback) => {
        handlers.push({
          eventName: _eventName,
          table: config?.table || null,
          filter: config?.filter || '',
          callback,
        });
        return channel;
      },
      subscribe: () => {
        const listener = (payload) => {
          handlers.forEach((handler) => {
            if (handler.table && aliasTableName(handler.table) !== aliasTableName(payload.table)) return;
            if (handler.filter) {
              const filterMatch = handler.filter.match(/^([^=]+)=eq\.(.+)$/);
              if (filterMatch) {
                const [, field, expected] = filterMatch;
                const rows = Array.isArray(payload.rows) ? payload.rows : [];
                const matches = rows.some((row) => String(row?.[field] ?? '') === String(expected));
                if (!matches) return;
              }
            }
            try {
              handler.callback?.(payload);
            } catch (error) {
              console.warn('[Local DB] channel callback error:', error);
            }
          });
        };
        subscriptions.add(listener);
        return {
          unsubscribe: () => subscriptions.delete(listener),
        };
      },
    };
    return channel;
  }

  removeChannel(channel) {
    if (channel && typeof channel.unsubscribe === 'function') {
      channel.unsubscribe();
    }
  }
}

const localSupabaseClient = new LocalSupabaseClient();

export default localSupabaseClient;
export { localSupabaseClient as supabase };
