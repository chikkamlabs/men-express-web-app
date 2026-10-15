'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Store,
  Shirt,
  Package,
  ShoppingBag,
  FolderTree,
  Truck,
  ShoppingCart,
  Users,
  UserCheck,
  Settings,
  X,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { name: 'Home', href: '/admin/dashboard', icon: Home },
  { name: 'Stores', href: '/admin/dashboard', icon: Store },
  { name: 'Products', href: '/admin/products', icon: Shirt },
  { name: 'Categories', href: '/admin/categories', icon: FolderTree },
  { name: 'Inventory', href: '/admin/dashboard', icon: Package },
  { name: 'Online orders', href: '/admin/onlineorders', icon: ShoppingBag },
  { name: 'Distributors', href: '/admin/distributors', icon: Truck },
  { name: 'Purchases', href: '/admin/dashboard', icon: ShoppingCart },
  { name: 'Customers', href: '/admin/customers', icon: Users },
  { name: 'Staffs', href: '/admin/staff', icon: UserCheck },
];

export default function AdminSidebar({ mobileOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  const renderNavList = (isMobile: boolean = false) => (
    <div className="flex flex-col h-full bg-white">
      {/* Mobile drawer header with close button */}
      {isMobile && (
        <div className="ui-sidebar-header flex items-center justify-between border-b border-zinc-200 px-4 h-14">
          <span className="font-bold text-base text-black">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="ui-btn ui-btn-ghost ui-btn-sm p-1"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5 text-black" />
          </button>
        </div>
      )}

      {/* Navigation items */}
      <nav className="ui-sidebar-nav flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/admin/dashboard'
              ? pathname === '/admin/dashboard'
              : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => {
                if (isMobile && onClose) {
                  onClose();
                }
              }}
              className={`ui-sidebar-item ${isActive ? 'ui-sidebar-item-active' : ''}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Settings at Bottom */}
      <div className="ui-sidebar-footer p-3 border-t border-zinc-200 mt-auto flex-shrink-0">
        <Link
          href="/admin/settings"
          onClick={() => {
            if (isMobile && onClose) {
              onClose();
            }
          }}
          className={`ui-sidebar-item ${
            pathname?.startsWith('/admin/settings') ? 'ui-sidebar-item-active' : ''
          }`}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          <span>Settings</span>
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sticky Sidebar (Visible ONLY on desktop screen sizes >= lg) */}
      <aside className="hidden lg:flex w-64 min-w-[16rem] flex-shrink-0 flex-col border-r border-zinc-200 bg-white sticky top-16 h-[calc(100vh-4rem)] overflow-y-auto">
        {renderNavList(false)}
      </aside>

      {/* Mobile/Tablet Drawer: NEVER visible on other screen sizes unless tapped to open */}
      {mobileOpen && (
        <div className="lg:hidden">
          {/* Backdrop below the header */}
          <div
            className="fixed inset-0 top-16 bg-black/50 z-40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer Panel below the header fitting any mobile or tablet height */}
          <aside className="fixed top-16 left-0 bottom-0 w-64 max-w-[80vw] h-[calc(100dvh-4rem)] bg-white border-r border-zinc-200 z-50 shadow-xl overflow-y-auto">
            {renderNavList(true)}
          </aside>
        </div>
      )}
    </>
  );
}
