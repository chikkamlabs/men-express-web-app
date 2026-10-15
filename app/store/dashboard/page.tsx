'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentSupabaseUser, signOutSupabase } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export default function StoreDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const { user, role } = await getCurrentSupabaseUser();
        if (!isMounted) return;

        if (user && (role === 'store' || role === 'admin')) {
          setIsAuthorized(true);
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

  const handleLogout = async () => {
    await signOutSupabase();
    router.replace('/login');
  };

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
    <div className="layout-page-container anim-page-enter">
      <header className="ui-header">
        <div className="ui-header-inner">
          <div className="ui-header-brand">
            <span>Store</span>
          </div>
          <div className="ui-header-actions">
            <button
              onClick={handleLogout}
              className="ui-btn ui-btn-outline ui-btn-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="layout-content-wrapper layout-flex-center">
        <h1 className="typo-page-title">Welcome Store</h1>
      </main>
    </div>
  );
}
