'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Menu, X, LogOut } from 'lucide-react';
import { signOutSupabase } from '@/lib/auth';

interface StoreHeaderProps {
  storeName?: string;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function StoreHeader({
  storeName = 'Store',
  onToggleSidebar,
  isSidebarOpen = false,
}: StoreHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOutSupabase();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      router.replace('/login');
    }
  };

  const handleToggleClick = () => {
    // For desktop screen size (width >= 1024), sidebar sticks and this button won't work
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      return;
    }
    if (onToggleSidebar) {
      onToggleSidebar();
    }
  };

  return (
    <header className="sticky top-0 left-0 right-0 w-full z-50 h-16 bg-white border-b border-zinc-200 px-3 sm:px-6 shadow-xs">
      <div className="flex items-center justify-between h-full w-full gap-2">
        {/* Left most: Button to Open and Close sidebar (won't work for desktop where sidebar sticks) + Logo + Men Express Bold Heading */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleToggleClick}
            className="lg:hidden ui-btn ui-btn-outline ui-btn-sm p-1.5 sm:p-2 flex-shrink-0 cursor-pointer"
            aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            aria-expanded={isSidebarOpen}
          >
            {isSidebarOpen ? (
              <X className="w-5 h-5 text-black" />
            ) : (
              <Menu className="w-5 h-5 text-black" />
            )}
          </button>

          {/* Logo */}
          <div className="relative w-7 h-7 sm:w-8 sm:h-8 flex-shrink-0">
            <Image
              src="/menexpress_logo.png"
              alt="Men Express Logo"
              width={32}
              height={32}
              className="w-full h-full object-contain rounded"
              priority
            />
          </div>

          {/* Men Express With Bold Heading */}
          <h1 className="font-bold text-base sm:text-lg md:text-xl text-black tracking-tight whitespace-nowrap">
            Men Express
          </h1>
        </div>

        {/* Center: Hello store name */}
        <div className="flex items-center justify-center flex-1 px-2 sm:px-4 text-center min-w-0">
          <span className="font-bold text-sm sm:text-base md:text-lg text-black tracking-tight truncate">
            Hello {storeName || 'Store'}
          </span>
        </div>

        {/* Right most: Logout and Logout button (navigate back to login page) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="ui-btn ui-btn-outline ui-btn-sm px-2.5 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1.5 font-medium text-black text-xs sm:text-sm cursor-pointer"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4 text-black flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
