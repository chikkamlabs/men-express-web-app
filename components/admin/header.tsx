'use client';

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Menu, LogOut } from 'lucide-react';
import { signOutSupabase } from '@/lib/auth';

interface AdminHeaderProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

export default function AdminHeader({
  onToggleSidebar,
  isSidebarOpen = false,
}: AdminHeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await signOutSupabase();
    router.replace('/login');
  };

  return (
    <header className="ui-header sticky top-0 left-0 right-0 w-full z-50 px-3 sm:px-6">
      <div className="ui-header-inner flex items-center justify-between w-full gap-2">
        {/* Left Section: Mobile Toggle Button + Logo + Bold Heading */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Button to open and close sidebar on mobile/tablet (hidden on desktop) */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden ui-btn ui-btn-outline ui-btn-sm p-1.5 sm:p-2 flex-shrink-0"
            aria-label={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            aria-expanded={isSidebarOpen}
          >
            <Menu className="w-4 h-4 sm:w-5 sm:h-5 text-black" />
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
          <h1 className="font-bold text-sm sm:text-base md:text-xl text-black tracking-tight whitespace-nowrap">
            Men Express
          </h1>
        </div>

        {/* Center Section: Hello Admin */}
        <div className="flex items-center justify-center flex-1 px-1 sm:px-4 text-center min-w-0">
          <span className="font-bold text-xs sm:text-sm md:text-lg text-black tracking-tight truncate">
            Hello Admin
          </span>
        </div>

        {/* Right Section: Logout label and Logout button */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={handleLogout}
            className="ui-btn ui-btn-outline ui-btn-sm px-2 sm:px-3 py-1 sm:py-1.5 flex items-center gap-1 sm:gap-1.5 font-medium text-black text-xs sm:text-sm"
          >
            <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-black flex-shrink-0" />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
