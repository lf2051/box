import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Box, PlugZap, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { useDeliveryHub } from '@/hooks/useDeliveryHub';

const IFOOD_DEFAULTS = {
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
};

const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '');

const normalizeIfoodDraft = (value = {}) => ({
  ...IFOOD_DEFAULTS,
  ...value,
  integrationUrl: normalizeUrl(value.integrationUrl || IFOOD_DEFAULTS.integrationUrl),
  clientId: String(value.clientId || '').trim(),
  clientSecret: String(value.clientSecret || '').trim(),
  merchantId: String(value.merchantId || '').trim(),
});

const IntegrationCard = ({ title, subtitle, icon: Icon, borderClass, children }) => (
  <section className={`rounded-lg border ${borderClass} bg-[var(--layout-surface-2)] p-5 shadow-lg sm:p-6`}>
    <div className="mb-2 flex items-center gap-3">
      <div className="rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] p-2">
        <Icon className="h-5 w-5 text-[var(--layout-accent)]" />
      </div>
      <h2 className="text-xl font-bold text-white">{title}</h2>
    </div>

    <p className="mb-4 text-sm text-[var(--layout-text-muted)]">{subtitle}</p>
    {children}
  </section>
);

const Field = ({ label, type = 'text', value, onChange, placeholder }) => (
  <div>
    <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--layout-text-muted)]">
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2 text-sm text-white outline-none focus:border-[var(--layout-accent)]"
    />
  </div>
);

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('pt-BR');
};

const Ifood99Page = () => {
  const { snapshot, saveIfoodSettings } = useDeliveryHub();
  const ifoodSettings = snapshot.settings?.ifood || IFOOD_DEFAULTS;

  const [ifoodDraft, setIfoodDraft] = useState(() => normalizeIfoodDraft(ifoodSettings));
  const [ifoodDirty, setIfoodDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingStock, setSyncingStock] = useState(false);

  useEffect(() => {
    setIfoodDraft(normalizeIfoodDraft(ifoodSettings));
    setIfoodDirty(false);
  }, [ifoodSettings]);

  const updateIfoodDraft = (field, value) => {
    setIfoodDirty(true);
    setIfoodDraft((current) => ({ ...current, [field]: value }));
  };

  const getMissingRequiredFields = (config) => {
    const missing = [];
    if (!config.clientId) missing.push('Client ID');
    if (!config.clientSecret) missing.push('Client Secret');
    if (!config.merchantId) missing.push('Merchant ID');
    return missing;
  };

  const saveDraft = async (options = {}) => {
    const { silent = false } = options;
    const cleaned = normalizeIfoodDraft(ifoodDraft);
    setSaving(true);
    try {
      await saveIfoodSettings(cleaned);
      setIfoodDirty(false);
      if (!silent) {
        toast({
          title: 'Configuracao salva',
          description: 'Credenciais iFood salvas com sucesso.',
        });
      }
      return cleaned;
    } finally {
      setSaving(false);
    }
  };

  const runIfoodRequest = async (path, payload) => {
    const baseUrl = normalizeUrl(ifoodDraft.integrationUrl);
    if (!baseUrl) {
      throw new Error('Informe a URL do mini servico de integracao.');
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const rawBody = await response.text();
    let data = {};
    if (rawBody) {
      try {
        data = JSON.parse(rawBody);
      } catch {
        data = {};
      }
    }

    if (!response.ok) {
      throw new Error(data?.message || `Falha na requisicao (${response.status}).`);
    }

    return data;
  };

  const saveConnectionMeta = async (status, message) => {
    await saveIfoodSettings({
      lastConnectionAt: new Date().toISOString(),
      lastConnectionStatus: status,
      lastConnectionMessage: message,
    });
  };

  const saveSyncMeta = async (status, message) => {
    await saveIfoodSettings({
      lastSyncAt: new Date().toISOString(),
      lastSyncStatus: status,
      lastSyncMessage: message,
    });
  };

  const ensureReadyConfig = async () => {
    const config = ifoodDirty ? await saveDraft({ silent: true }) : normalizeIfoodDraft(ifoodDraft);
    const missing = getMissingRequiredFields(config);
    if (missing.length > 0) {
      throw new Error(`Preencha: ${missing.join(', ')}.`);
    }
    return config;
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      const config = await ensureReadyConfig();
      const data = await runIfoodRequest('/ifood/test-connection', {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        merchantId: config.merchantId,
      });

      const message = data?.message || 'Conexao com iFood validada com sucesso.';
      await saveConnectionMeta('success', message);
      toast({
        title: 'Conexao validada',
        description: message,
      });
    } catch (error) {
      const message = error.message || 'Falha ao testar conexao.';
      await saveConnectionMeta('error', message);
      toast({
        variant: 'destructive',
        title: 'Falha na conexao',
        description: message,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncStock = async () => {
    setSyncingStock(true);
    try {
      const config = await ensureReadyConfig();
      const stockItems = (snapshot.products || []).map((product) => ({
        id: product.id,
        codigo: product.codigo || '',
        descricao: product.descricao || '',
        estoque: Number(product.estoque || 0),
      }));

      if (stockItems.length === 0) {
        throw new Error('Nenhum produto encontrado para sincronizar estoque.');
      }

      const data = await runIfoodRequest('/ifood/sync-stock', {
        merchantId: config.merchantId,
        itens: stockItems,
      });

      const message = data?.message || `Sincronizacao concluida com ${stockItems.length} itens.`;
      await saveSyncMeta('success', message);
      toast({
        title: 'Estoque sincronizado',
        description: message,
      });
    } catch (error) {
      const message = error.message || 'Falha ao sincronizar estoque.';
      await saveSyncMeta('error', message);
      toast({
        variant: 'destructive',
        title: 'Erro na sincronizacao',
        description: message,
      });
    } finally {
      setSyncingStock(false);
    }
  };

  return (
    <div className="animate-in fade-in p-4 duration-500 sm:p-6">
      <Helmet>
        <title>IFOOD & 99 - Dashboard</title>
      </Helmet>

      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold text-white">IFOOD & 99</h1>
        <p className="text-[var(--layout-text-muted)]">Integracao para API de estoque</p>
      </div>

      <div className="space-y-6">
        <IntegrationCard
          title="iFood"
          subtitle="Configure as credenciais e use o mini servico para testar conexao e sincronizar estoque."
          icon={Store}
          borderClass="border-emerald-500/30"
        >
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Client ID"
                value={ifoodDraft.clientId}
                onChange={(event) => updateIfoodDraft('clientId', event.target.value)}
                placeholder="Seu Client ID do iFood Developer"
              />
              <Field
                label="Merchant ID"
                value={ifoodDraft.merchantId}
                onChange={(event) => updateIfoodDraft('merchantId', event.target.value)}
                placeholder="ID da sua loja no iFood"
              />
              <Field
                label="Client Secret"
                type="password"
                value={ifoodDraft.clientSecret}
                onChange={(event) => updateIfoodDraft('clientSecret', event.target.value)}
                placeholder="Seu Client Secret"
              />
              <Field
                label="URL do Mini Servico"
                value={ifoodDraft.integrationUrl}
                onChange={(event) => updateIfoodDraft('integrationUrl', event.target.value)}
                placeholder="http://localhost:8787"
              />
            </div>

            <div className="rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <PlugZap className="h-4 w-4 text-[var(--layout-accent)]" />
                Endpoints esperados no mini servico
              </div>
              <div className="space-y-1 text-xs text-[var(--layout-text-muted)]">
                <p>`POST /ifood/test-connection` para validar credenciais.</p>
                <p>`POST /ifood/sync-stock` para enviar os itens de estoque.</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => saveDraft()} disabled={saving || testingConnection || syncingStock}>
                {saving ? 'Salvando...' : 'Salvar credenciais'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleTestConnection}
                disabled={saving || testingConnection || syncingStock}
              >
                {testingConnection ? 'Testando...' : 'Testar conexao'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleSyncStock}
                disabled={saving || testingConnection || syncingStock}
              >
                {syncingStock ? 'Sincronizando...' : `Sincronizar estoque (${snapshot.products.length})`}
              </Button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--layout-text-muted)]">
                  Ultimo teste de conexao
                </div>
                <div className="mt-1 text-sm text-white">{formatDateTime(ifoodSettings.lastConnectionAt)}</div>
                <div className="mt-1 text-xs text-[var(--layout-text-muted)]">
                  {ifoodSettings.lastConnectionMessage || '-'}
                </div>
              </div>
              <div className="rounded-lg border border-[var(--layout-border)] bg-[var(--layout-bg)] px-3 py-2">
                <div className="text-xs uppercase tracking-[0.18em] text-[var(--layout-text-muted)]">
                  Ultima sincronizacao de estoque
                </div>
                <div className="mt-1 text-sm text-white">{formatDateTime(ifoodSettings.lastSyncAt)}</div>
                <div className="mt-1 text-xs text-[var(--layout-text-muted)]">{ifoodSettings.lastSyncMessage || '-'}</div>
              </div>
            </div>
          </div>
        </IntegrationCard>

        <IntegrationCard
          title="99"
          subtitle="Bloco reservado para a segunda etapa da integracao de estoque."
          icon={Box}
          borderClass="border-sky-500/30"
        >
          <div className="rounded-lg border border-dashed border-[var(--layout-border)] bg-[var(--layout-bg)] p-4">
            <p className="text-sm text-gray-300">
              Estrutura pronta. Na proxima etapa, colocamos os campos de credenciais e a rotina de sincronizacao da
              99.
            </p>
          </div>
        </IntegrationCard>
      </div>
    </div>
  );
};

export default Ifood99Page;
