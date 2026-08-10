import React, { useState, useEffect } from 'react';
import { LogOut, User, Clock, Menu } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

const Header = ({ onMenuClick }) => {
  const { user, logout } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatDate = (date) => {
    return date.toLocaleDateString('pt-BR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (date) => {
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Safe access to user data
  const userName = user?.user_metadata?.name || 'Brasa & Fogão Restaurante';

  return (
    <header className="relative shrink-0 border-b border-[var(--layout-border)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--layout-accent)_8%,transparent)_0%,transparent_38%),var(--layout-surface)] px-4 py-4 sm:px-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(90deg,transparent,var(--layout-accent),transparent)]" />
      <div className="ag-enter flex items-center justify-between gap-3 w-full sm:w-auto" data-ag-delay="1">
        <div className="flex items-center gap-3">
          {onMenuClick ? (
            <button
              type="button"
              onClick={onMenuClick}
              className="ag-cut-sm border border-[var(--layout-border)] p-2 text-[var(--layout-text-muted)] hover:border-[var(--layout-accent)] hover:text-[var(--layout-text)] md:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          ) : null}
          <div className="ag-cut-sm ag-chip inline-flex items-center gap-2 px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-[var(--layout-accent)] animate-pulse" />
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--layout-text-muted)]">Sistema Online</span>
          </div>
        </div>
      </div>

      <div className="ag-enter flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-6" data-ag-delay="2">
        <div className="text-right hidden sm:block">
          <div className="text-sm text-[var(--layout-text-muted)] capitalize">{formatDate(currentTime)}</div>
          <div className="text-lg font-semibold text-[var(--layout-text)] flex items-center justify-end gap-2">
            <Clock className="w-4 h-4 text-[var(--layout-accent)]" />
            {formatTime(currentTime)}
          </div>
        </div>

        <div className="h-10 w-px bg-[var(--layout-border)] hidden sm:block"></div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="ag-cut-sm flex w-full items-center gap-2 border border-[var(--layout-border)] bg-[var(--layout-surface-2)] px-3 py-2 sm:w-auto">
            <User className="w-4 h-4 text-[var(--layout-accent)]" />
            <div className="text-sm min-w-0">
              <div className="max-w-[200px] truncate font-medium text-[var(--layout-text)]">{userName}</div>
            </div>
          </div>

          <Button
            onClick={logout}
            variant="outline"
            size="sm"
            className="border-[var(--layout-border)] bg-transparent text-[var(--layout-text)] hover:border-red-500 hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline">Sair</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
