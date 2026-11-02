'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import StoreHeader from '@/components/store/header';
import StoreSidebar from '@/components/store/sidebar';

export default function StoreDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storeName, setStoreName] = useState('Store');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const { user, role } = await getCurrentSupabaseUser();
        if (!isMounted) return;

        if (user && (role === 'store' || role === 'admin')) {
          setIsAuthorized(true);
          
          // Resolve store name
          let resolvedName = user.user_metadata?.name || '';
          if (!resolvedName) {
            try {
              const { data } = await supabase
                .from('stores')
                .select('name')
                .eq('id', user.id)
                .maybeSingle();
              if (data?.name) {
                resolvedName = data.name;
              }
            } catch {
              // Ignore lookup errors
            }
          }
          if (!resolvedName && user.email) {
            resolvedName = user.email.split('@')[0];
          }
          if (resolvedName) {
            setStoreName(resolvedName);
          }

          setLoading(false);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isMounted) return;
        if (event === 'SIGNED_OUT' || !session) {
          router.replace('/login');
        } else if (session?.user) {
          const { role } = await getCurrentSupabaseUser();
          if (role === 'store' || role === 'admin') {
            setIsAuthorized(true);
            setLoading(false);
          } else {
            router.replace('/login');
          }
        }
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const addBillBtnRef = React.useRef<HTMLAnchorElement | HTMLButtonElement>(null);

  // Keyboard shortcut: if on store/dashboard and user presses Enter, focus on Add Bill button and navigate
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Enter') {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
          return;
        }
        e.preventDefault();
        if (addBillBtnRef.current) {
          addBillBtnRef.current.focus();
        }
        router.push('/store/createbill');
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [router]);

  if (loading) {
    return (
      <div className="layout-page-container layout-flex-center">
        <p className="typo-body">Loading...</p>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-white anim-page-enter relative">
      {/* On top Header covers everything across top */}
      <StoreHeader
        storeName={storeName}
        isSidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />

      {/* After the Header the sidebar starts */}
      <div className="flex flex-1 relative min-h-[calc(100vh-4rem)]">
        <StoreSidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-zinc-50 overflow-y-auto relative pb-24">
          <div className="max-w-7xl mx-auto">
            <h1 className="typo-page-title mb-2">Store Dashboard</h1>
            <p className="typo-body text-zinc-600">
              Welcome to the Men Express Store Portal.
            </p>
          </div>

          {/* Add Bill Button on bottom right (Tapping Enter on keyboard focuses and opens) */}
          <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-30">
            <button
              ref={addBillBtnRef as any}
              type="button"
              onClick={() => router.push('/store/createbill')}
              className="ui-btn ui-btn-primary ui-btn-lg px-5 py-3 shadow-xl hover:shadow-2xl flex items-center gap-2.5 font-bold text-sm sm:text-base rounded-xl cursor-pointer border-2 border-black transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              aria-label="Add Bill"
            >
              <span className="w-5 h-5 rounded-full bg-white text-black flex items-center justify-center font-black text-xs">
                +
              </span>
              <span>Add Bill</span>
              <span className="text-[10px] opacity-75 font-mono ml-1 px-1.5 py-0.5 bg-zinc-800 rounded border border-zinc-700 hidden sm:inline-block">
                Enter ↵
              </span>
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

