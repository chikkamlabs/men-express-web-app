'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, Palette, Ruler, ExternalLink } from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import AdminHeader from '@/components/admin/header';
import AdminSidebar from '@/components/admin/sidebar';
import ColorsModal from '@/components/admin/colors';
import SizesModal from '@/components/admin/sizes';
import {
  ColorItem,
  SizeItem,
  getColors,
  getSizes,
} from '@/lib/settingsStore';

export default function AdminSettingsDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Settings Data
  const [colors, setColors] = useState<ColorItem[]>([]);
  const [sizes, setSizes] = useState<SizeItem[]>([]);
  const [, setDataLoading] = useState(true);

  // Modals state
  const [isColorsModalOpen, setIsColorsModalOpen] = useState(false);
  const [isSizesModalOpen, setIsSizesModalOpen] = useState(false);

  // Authentication check
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const { user, role } = await getCurrentSupabaseUser();
        if (!isMounted) return;

        if (user && role === 'admin') {
          setIsAuthorized(true);
          setAuthLoading(false);
        } else {
          router.replace('/login');
        }
      } catch {
        if (isMounted) {
          router.replace('/login');
        }
      }
    }

    checkAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/login');
      } else if (session?.user) {
        const { role } = await getCurrentSupabaseUser();
        if (role === 'admin') {
          setIsAuthorized(true);
          setAuthLoading(false);
        } else {
          router.replace('/login');
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  // Load colors and sizes
  useEffect(() => {
    let ignore = false;
    if (isAuthorized) {
      Promise.all([getColors(), getSizes()]).then(
        ([colorsRes, sizesRes]) => {
          if (!ignore) {
            if (colorsRes.data) setColors(colorsRes.data);
            if (sizesRes.data) setSizes(sizesRes.data);
            setDataLoading(false);
          }
        }
      );
    }
    return () => {
      ignore = true;
    };
  }, [isAuthorized]);

  const handleColorCreated = (newColor: ColorItem) => {
    setColors((prev) => [...prev, newColor]);
  };

  const handleSizeCreated = (newSize: SizeItem) => {
    setSizes((prev) => [...prev, newSize]);
  };

  if (authLoading) {
    return (
      <div className="layout-page-container layout-flex-center min-h-screen bg-white">
        <p className="typo-body text-zinc-600">Loading...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white w-full max-w-full overflow-x-hidden">
      {/* Admin Header */}
      <AdminHeader
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        isSidebarOpen={sidebarOpen}
      />

      <div className="flex flex-1 min-h-[calc(100vh-4rem)] w-full max-w-full relative overflow-x-hidden">
        {/* Admin Sidebar */}
        <AdminSidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Dashboard Content */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-white">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Top Bar: Heading Settings */}
            <div className="flex items-center gap-3 pb-4 border-b border-zinc-200">
              <div className="p-2.5 bg-zinc-100 rounded-lg text-black border border-zinc-200">
                <Settings className="w-6 h-6 text-black" />
              </div>
              <div>
                <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                  Settings
                </h1>
                <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                  Configure store product attributes, color master palette, and standard sizing options
                </p>
              </div>
            </div>

            {/* 1. Colors Section: Put colors and Open Colors button */}
            <div className="ui-card border border-zinc-200 rounded-xl bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-zinc-100 rounded-lg border border-zinc-200 flex-shrink-0 mt-0.5">
                    <Palette className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h2 className="typo-section-title text-base sm:text-lg font-bold text-black">
                      Colors
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                      Master clothing color palette with hex codes used across product variants and store catalog.
                    </p>
                  </div>
                </div>

                {/* Open Colors button: Grey color, turns dark black on tap */}
                <button
                  type="button"
                  onClick={() => setIsColorsModalOpen(true)}
                  className="ui-btn ui-btn-grey ui-btn-md px-5 py-2 font-medium flex items-center justify-center gap-2 cursor-pointer shadow-xs whitespace-nowrap self-start sm:self-auto"
                >
                  <ExternalLink className="w-4 h-4 text-white" />
                  <span>Open Colors</span>
                </button>
              </div>

              {/* Quick preview of colors */}
              <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500 font-medium mr-2">
                  Total Colors ({colors.length}):
                </span>
                {colors.length === 0 ? (
                  <span className="text-xs text-zinc-400">
                    No colors in database yet. Click &quot;Open Colors&quot; to create.
                  </span>
                ) : (
                  <>
                    {colors.slice(0, 10).map((color) => (
                      <div
                        key={color.id}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-50 border border-zinc-200 rounded-md text-xs font-medium text-black"
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-zinc-300"
                          style={{ backgroundColor: color.code }}
                          aria-hidden="true"
                        />
                        <span>{color.name}</span>
                      </div>
                    ))}
                    {colors.length > 10 && (
                      <span className="text-xs text-zinc-400 font-mono">
                        +{colors.length - 10} more
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* 2. After Colors: Put Sizes and Open Sizes button */}
            <div className="ui-card border border-zinc-200 rounded-xl bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-zinc-100 rounded-lg border border-zinc-200 flex-shrink-0 mt-0.5">
                    <Ruler className="w-5 h-5 text-black" />
                  </div>
                  <div>
                    <h2 className="typo-section-title text-base sm:text-lg font-bold text-black">
                      Sizes
                    </h2>
                    <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                      Standard clothing and apparel sizing options (e.g. S, M, L, XL, 38, 40) for inventory tracking.
                    </p>
                  </div>
                </div>

                {/* Open Sizes button: Grey color, turns dark black on tap */}
                <button
                  type="button"
                  onClick={() => setIsSizesModalOpen(true)}
                  className="ui-btn ui-btn-grey ui-btn-md px-5 py-2 font-medium flex items-center justify-center gap-2 cursor-pointer shadow-xs whitespace-nowrap self-start sm:self-auto"
                >
                  <ExternalLink className="w-4 h-4 text-white" />
                  <span>Open Sizes</span>
                </button>
              </div>

              {/* Quick preview of sizes */}
              <div className="pt-3 border-t border-zinc-100 flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500 font-medium mr-2">
                  Total Sizes ({sizes.length}):
                </span>
                {sizes.length === 0 ? (
                  <span className="text-xs text-zinc-400">
                    No sizes in database yet. Click &quot;Open Sizes&quot; to create.
                  </span>
                ) : (
                  sizes.map((size) => (
                    <span
                      key={size.id}
                      className="inline-flex items-center px-2.5 py-1 bg-zinc-100 border border-zinc-300 rounded font-mono text-xs font-semibold text-black"
                    >
                      {size.value}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Colors Modal */}
      {isColorsModalOpen && (
        <ColorsModal
          isOpen={isColorsModalOpen}
          onClose={() => setIsColorsModalOpen(false)}
          colors={colors}
          onColorCreated={handleColorCreated}
        />
      )}

      {/* Sizes Modal */}
      {isSizesModalOpen && (
        <SizesModal
          isOpen={isSizesModalOpen}
          onClose={() => setIsSizesModalOpen(false)}
          sizes={sizes}
          onSizeCreated={handleSizeCreated}
        />
      )}
    </div>
  );
}
