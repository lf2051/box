import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import MobileSidebar from '@/components/MobileSidebar';

const Dashboard = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="ag-speedlines relative flex min-h-[100dvh] bg-[var(--layout-bg)] text-[var(--layout-text)]">
      <Sidebar />
      <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="ag-cut ag-enter relative z-[1] flex min-h-[100dvh] min-w-0 flex-1 flex-col overflow-hidden border-l border-[var(--layout-border)]/70 bg-[var(--layout-surface)]/84 md:m-2 md:border md:border-[var(--layout-border)] md:shadow-[0_30px_55px_-35px_var(--layout-accent)]">
        <Header onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="min-w-0 flex-1 overflow-auto overflow-x-hidden bg-[var(--layout-bg)]/48">
          <div className="app-outlet-frame min-w-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Dashboard;
