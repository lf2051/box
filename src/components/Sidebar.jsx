import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { sidebarMenuItems } from '@/components/sidebarMenuItems';
import { BRAND_LOGO_PATH, BRAND_NAME, BRAND_TAGLINE } from '@/config/brand';

const Sidebar = () => {
  const location = useLocation();

  return (
    <aside className="ag-shell ag-enter-left hidden w-80 shrink-0 flex-col border-r border-[var(--layout-border)]/75 md:flex">
      <div className="ag-divider p-6" data-ag-delay="1">
        <div className="flex items-center gap-3">
          <div className="ag-cut-sm flex h-14 w-14 items-center justify-center border border-[var(--layout-border)] bg-[var(--layout-elevated)] shadow-[0_14px_30px_-22px_var(--layout-accent)]">
            <img src={BRAND_LOGO_PATH} alt={BRAND_NAME} className="h-11 w-11 object-cover" />
          </div>
          <div>
            <h1 className="ag-heading text-3xl leading-none text-[var(--layout-text)]">{BRAND_NAME}</h1>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--layout-text-muted)]">{BRAND_TAGLINE}</p>
          </div>
        </div>
      </div>

      <nav className="custom-scrollbar ag-stagger flex-1 space-y-1.5 overflow-y-auto p-4">
        {sidebarMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'group ag-cut-sm relative flex items-center gap-3 border px-4 py-3 text-sm font-bold uppercase tracking-[0.1em] transition-all duration-200',
                isActive
                  ? 'border-[var(--layout-accent)] bg-[linear-gradient(112deg,var(--layout-accent)_0%,#ffe457_100%)] text-[#1f2937] [text-shadow:none] shadow-[0_16px_36px_-22px_var(--layout-accent)]'
                  : 'border-[var(--layout-border)]/40 text-[var(--layout-text)] hover:-translate-x-0.5 hover:border-[var(--layout-accent)]/65 hover:bg-[var(--layout-surface-2)] hover:text-[var(--layout-text)]',
              )}
            >
              <Icon className={cn('h-5 w-5 transition-transform group-hover:scale-110', isActive ? 'scale-105' : '')} />
              <span className="tracking-[0.08em]">{item.label}</span>
              {isActive ? <div className="absolute right-2 h-2 w-2 animate-pulse bg-[#1f2937]" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="ag-divider bg-[var(--layout-surface-2)]/80 p-4" data-ag-delay="2">
        <div className="flex items-center justify-between px-2 text-xs text-[var(--layout-text-muted)]">
          <span>Versão 1.0.0</span>
          <div className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--layout-accent)]" title="Online" />
            <span>Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;

