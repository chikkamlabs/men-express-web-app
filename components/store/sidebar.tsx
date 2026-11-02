'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Receipt,
  Shirt,
  Package,
  ArrowLeftRight,
  User,
  X,
} from 'lucide-react';

interface StoreSidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Home', href: '/store/dashboard', icon: Home },
  { name: 'Store Bills', href: '/store/bills', icon: Receipt },
  { name: 'Store Products', href: '/store/products', icon: Shirt },
  { name: 'Distributions', href: '/store/distributions', icon: Package },
  { name: 'Store Transfers', href: '/store/transfers', icon: ArrowLeftRight },
  { name: 'Profile', href: '/store/profile', icon: User },
];

export default function StoreSidebar({
  mobileOpen = false,
  onClose,
}: StoreSidebarProps) {
  const pathname = usePathname();

  const renderNavList = (isMobile: boolean = false) => (
    <div className="flex flex-col h-full bg-white">
      {/* Mobile drawer header with close button */}
      {isMobile && (
        <div className="ui-sidebar-header flex items-center justify-between border-b border-zinc-200 px-4 h-14">
          <span className="font-bold text-base text-black">Store Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="ui-btn ui-btn-ghost ui-btn-sm p-1 cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>
      )}

      {/* Navigation items */}
      <nav className="ui-sidebar-nav flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item, index) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/store/dashboard'
              ? pathname === '/store/dashboard'
              : (pathname?.startsWith(item.href) ||
                 (item.href === '/store/products' && pathname?.startsWith('/store/openproduct')) ||
                 (item.href === '/store/bills' && pathname?.startsWith('/store/createbill')));

          return (
            <Link
              key={`${item.name}-${index}`}
              href={item.href}
              onClick={() => {
                if (isMobile && onClose) {
                  onClose();
                }
              }}
              className={`ui-sidebar-item ${
                isActive ? 'ui-sidebar-item-active' : ''
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar (Visible ONLY on desktop screen sizes >= lg, sticks to left of dashboard below top header) */}
      <aside className="hidden lg:flex w-64 min-w-[16rem] flex-shrink-0 flex-col border-r border-zinc-200 bg-white sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto z-20">
        {renderNavList(false)}
      </aside>

      {/* Mobile Drawer (opens on tap, closes on tap outside or on close/nav item) */}
      {mobileOpen && (
        <div className="lg:hidden">
          {/* Backdrop below top header */}
          <div
            className="fixed inset-0 top-16 bg-black/50 z-40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Panel below top header */}
          <aside className="fixed top-16 left-0 bottom-0 w-64 max-w-[80vw] h-[calc(100dvh-4rem)] bg-white border-r border-zinc-200 z-50 shadow-xl overflow-y-auto">
            {renderNavList(true)}
          </aside>
        </div>
      )}
    </>
  );
}
