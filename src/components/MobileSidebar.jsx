import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sidebarMenuItems } from '@/components/sidebarMenuItems';
import { BRAND_LOGO_PATH, BRAND_NAME, BRAND_TAGLINE } from '@/config/brand';

const MobileSidebar = ({ isOpen, onClose }) => {
  const location = useLocation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] md:hidden">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="ag-shell ag-enter-left absolute inset-y-0 left-0 z-[90] flex w-[86vw] max-w-sm flex-col border-r border-[var(--layout-border)] shadow-2xl">
        <div className="ag-divider flex items-center justify-between p-4" data-ag-delay="1">
          <div className="flex items-center gap-3">
            <div className="ag-cut-sm flex h-11 w-11 items-center justify-center border border-[var(--layout-border)] bg-[var(--layout-elevated)]">
              <img src={BRAND_LOGO_PATH} alt={BRAND_NAME} className="h-9 w-9 object-cover" />
            </div>
            <div>
              <h1 className="ag-heading text-2xl leading-none text-[var(--layout-text)]">{BRAND_NAME}</h1>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--layout-text-muted)]">{BRAND_TAGLINE}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ag-cut-sm border border-[var(--layout-border)] p-2 text-[var(--layout-text-muted)] hover:border-[var(--layout-accent)] hover:text-[var(--layout-text)]"
            aria-label="Fechar menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="custom-scrollbar ag-stagger flex-1 space-y-1.5 overflow-y-auto p-3">
          {sidebarMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  'group ag-cut-sm relative flex items-center gap-3 border px-4 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-all duration-200',
                  isActive
                    ? 'border-[var(--layout-accent)] bg-[linear-gradient(112deg,var(--layout-accent)_0%,#ffe457_100%)] text-[#1f2937] [text-shadow:none] shadow-[0_16px_36px_-22px_var(--layout-accent)]'
                    : 'border-[var(--layout-border)]/45 text-[var(--layout-text)] hover:-translate-x-0.5 hover:border-[var(--layout-accent)]/65 hover:bg-[var(--layout-surface-2)] hover:text-[var(--layout-text)]',
                )}
              >
                <Icon className={cn('h-5 w-5 transition-transform group-hover:scale-110', isActive ? 'scale-105' : '')} />
                <span className="font-medium">{item.label}</span>
                {isActive ? <div className="absolute right-2 h-2 w-2 animate-pulse bg-[#1f2937]" /> : null}
              </Link>
            );
          })}
        </nav>

        <div className="ag-divider bg-[var(--layout-surface-2)]/85 p-3" data-ag-delay="2">
          <div className="flex items-center justify-between px-2 text-[10px] text-[var(--layout-text-muted)]">
            <span>Versão 1.0.0</span>
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-[var(--layout-accent)]" title="Online" />
              <span>Online</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default MobileSidebar;

