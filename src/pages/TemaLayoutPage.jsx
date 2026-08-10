import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { applyTheme, getStoredTheme, THEMES } from '@/utils/theme';
import { BRAND_NAME } from '@/config/brand';

const TemaLayoutPage = () => {
  const { toast } = useToast();
  const [activeTheme, setActiveTheme] = useState(getStoredTheme());

  useEffect(() => {
    applyTheme(activeTheme);
  }, [activeTheme]);

  const handleSelectTheme = (key) => {
    setActiveTheme(key);
    toast({
      title: 'Tema atualizado',
      description: 'As cores do layout foram aplicadas imediatamente.',
    });
  };

  return (
    <div className="ag-speedlines p-4 sm:p-6">
      <Helmet>
        <title>Cores do Layout - {BRAND_NAME}</title>
      </Helmet>

      <div className="ag-enter mb-6 flex items-start gap-3">
        <div className="ag-cut-sm flex h-12 w-12 items-center justify-center border border-[var(--layout-border)] bg-[var(--layout-elevated)] text-[var(--layout-accent)]">
          <Palette className="h-6 w-6" />
        </div>
        <div>
          <h1 className="ag-heading text-4xl leading-none text-[var(--layout-text)]">Mudar as cores do layout</h1>
          <p className="text-[var(--layout-text-muted)]">
            Escolha um tema para aplicar novas cores ao painel inteiro.
          </p>
        </div>
      </div>

      <div className="ag-stagger grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {THEMES.map((theme) => {
          const isActive = activeTheme === theme.key;
          return (
            <div
              key={theme.key}
              className={`ag-cut ag-panel border p-4 transition-all ${
                isActive
                  ? 'border-[var(--layout-accent)] bg-[var(--layout-surface-2)] shadow-[0_24px_36px_-25px_var(--layout-accent)]'
                  : 'border-[var(--layout-border)] bg-[var(--layout-surface)]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold text-[var(--layout-text)]">{theme.name}</div>
                  <div className="text-sm text-[var(--layout-text-muted)]">{theme.description}</div>
                </div>
                {isActive ? (
                  <span className="rounded-full bg-[var(--layout-accent)] px-3 py-1 text-xs font-semibold text-[var(--layout-text)]">
                    Ativo
                  </span>
                ) : null}
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="h-10 rounded-lg" style={{ background: theme.preview.bg }} />
                <div className="h-10 rounded-lg" style={{ background: theme.preview.surface }} />
                <div className="h-10 rounded-lg" style={{ background: theme.preview.border }} />
                <div className="h-10 rounded-lg" style={{ background: theme.preview.accent }} />
              </div>

              <Button
                onClick={() => handleSelectTheme(theme.key)}
                className={`mt-4 w-full ${
                  isActive
                    ? 'bg-[var(--layout-accent)] text-[var(--layout-text)] hover:bg-[var(--layout-accent-strong)]'
                    : 'bg-[var(--layout-surface-2)] text-[var(--layout-text)] hover:bg-[var(--layout-border)]'
                }`}
              >
                {isActive ? 'Tema em uso' : 'Aplicar tema'}
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TemaLayoutPage;

