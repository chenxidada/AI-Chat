'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/topbar';
import { SearchCommand } from '@/components/search/search-command';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSearchOpen = useCallback(() => setSearchOpen(true), []);
  const handleSearchClose = useCallback(() => setSearchOpen(false), []);

  return (
    <div className="h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onSearchOpen={handleSearchOpen} />
        <main className="flex-1 overflow-auto bg-white">
          {children}
        </main>
      </div>
      <SearchCommand open={searchOpen} onClose={handleSearchClose} />
    </div>
  );
}
