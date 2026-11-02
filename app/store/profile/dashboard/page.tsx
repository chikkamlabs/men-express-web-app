'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  User,
  Store,
  Mail,
  Phone,
  MapPin,
  KeyRound,
  LogOut,
  Calendar,
  ShieldCheck,
  X,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';
import { getCurrentSupabaseUser } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import StoreHeader from '@/components/store/header';
import StoreSidebar from '@/components/store/sidebar';
import { StoreItem, getStoreById, changeStorePassword } from '@/lib/stores';

export default function StoreProfileDashboardPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentStoreId, setCurrentStoreId] = useState<string | undefined>(undefined);
  const [storeName, setStoreName] = useState('Store');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Store data
  const [storeDetails, setStoreDetails] = useState<StoreItem | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  // Change Password Modal State ("Open a overscreen small section")
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Logout state
  const [loggingOut, setLoggingOut] = useState(false);

  // Authentication check
  useEffect(() => {
    let isMounted = true;

    async function checkAuth() {
      try {
        const { user, role } = await getCurrentSupabaseUser();
        if (!isMounted) return;

        if (user && (role === 'store' || role === 'admin')) {
          setIsAuthorized(true);
          setCurrentStoreId(user.id);
          setUserEmail(user.email || '');

          // Resolve store name
          let resolvedName = user.user_metadata?.name || '';
          if (!resolvedName && user.email) {
            resolvedName = user.email.split('@')[0];
          }
          if (resolvedName) {
            setStoreName(resolvedName);
          }

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
  }, [router]);

  // Load store details
  useEffect(() => {
    let isMounted = true;

    async function loadStoreProfile() {
      if (!currentStoreId) return;

      const { data } = await getStoreById(currentStoreId);
      if (isMounted && data) {
        setStoreDetails(data);
        if (data.name) {
          setStoreName(data.name);
        }
      }
    }

    if (isAuthorized && currentStoreId) {
      loadStoreProfile();
    }

    return () => {
      isMounted = false;
    };
  }, [isAuthorized, currentStoreId]);

  // Change Password Submit
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!currentPassword) {
      setPasswordError('Please enter your current password.');
      return;
    }

    if (!newPassword) {
      setPasswordError('Please enter a new password.');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Changing password and Confirm password do not match.');
      return;
    }

    setPasswordSaving(true);

    const emailToUse = storeDetails?.email || userEmail;
    const result = await changeStorePassword(
      emailToUse,
      currentPassword,
      newPassword,
      currentStoreId
    );

    if (!result.success || result.error) {
      setPasswordError(result.error?.message || 'Failed to update password.');
      setPasswordSaving(false);
      return;
    }

    setPasswordSuccess('Password changed successfully!');
    setPasswordSaving(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');

    // Auto-close modal after 2 seconds
    setTimeout(() => {
      setIsPasswordModalOpen(false);
      setPasswordSuccess(null);
    }, 2000);
  };

  // Logout handler
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
    router.replace('/login');
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
      {/* On top Header covers everything */}
      <StoreHeader
        storeName={storeName}
        isSidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
      />

      <div className="flex flex-1 min-h-[calc(100vh-4rem)] w-full max-w-full relative overflow-x-hidden">
        {/* Sidebar */}
        <StoreSidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-full overflow-x-hidden bg-zinc-50 pb-20">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Top Bar Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-zinc-200">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-lg text-black border border-zinc-200 shadow-xs">
                  <User className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h1 className="typo-page-title text-xl sm:text-2xl font-bold text-black tracking-tight">
                    Store Profile
                  </h1>
                  <p className="typo-caption text-xs sm:text-sm text-zinc-500">
                    Manage store account details, security credentials, and session
                  </p>
                </div>
              </div>

              {/* Action buttons on header */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordError(null);
                    setPasswordSuccess(null);
                    setIsPasswordModalOpen(true);
                  }}
                  className="ui-btn ui-btn-outline ui-btn-sm px-3.5 py-2 flex items-center gap-1.5 text-xs font-semibold rounded-lg bg-white border border-zinc-300 hover:bg-zinc-100 text-black cursor-pointer shadow-xs"
                >
                  <KeyRound className="w-3.5 h-3.5 text-zinc-700" />
                  <span>Change Password</span>
                </button>

                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="ui-btn ui-btn-outline ui-btn-sm px-3.5 py-2 flex items-center gap-1.5 text-xs font-semibold rounded-lg border-rose-300 text-rose-700 hover:bg-rose-50 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-600" />
                  <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
                </button>
              </div>
            </div>

            {/* Basic Details Card */}
            <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-zinc-600" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700">
                    Basic Store Details
                  </h2>
                </div>
                {storeDetails?.store_id && (
                  <span className="font-mono text-xs font-bold bg-zinc-100 text-black px-2.5 py-0.5 rounded border border-zinc-200">
                    {storeDetails.store_id}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Store Name */}
                <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                  <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Store Name
                  </span>
                  <div className="text-base font-bold text-black">
                    {storeDetails?.name || storeName}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Physical Retail Outlet
                  </div>
                </div>

                {/* Store ID / Code */}
                <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                  <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                    Store ID / Code
                  </span>
                  <div className="text-base font-mono font-bold text-black">
                    {storeDetails?.store_id || 'store_1'}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Unique Outlet Identifier
                  </div>
                </div>

                {/* Email Address */}
                <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                  <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Mail className="w-3 h-3 text-zinc-400" />
                    <span>Email Address</span>
                  </span>
                  <div className="text-sm font-semibold text-black">
                    {storeDetails?.email || userEmail || '—'}
                  </div>
                  <div className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" />
                    <span>Used for POS Authentication</span>
                  </div>
                </div>

                {/* Mobile Number */}
                <div className="p-4 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                  <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <Phone className="w-3 h-3 text-zinc-400" />
                    <span>Contact Number</span>
                  </span>
                  <div className="text-sm font-mono font-semibold text-black">
                    {storeDetails?.mobile || 'No contact phone listed'}
                  </div>
                  <div className="text-xs text-zinc-500">
                    Primary Store Contact
                  </div>
                </div>

                {/* Physical Address */}
                <div className="md:col-span-2 p-4 rounded-lg bg-zinc-50 border border-zinc-200 space-y-1">
                  <span className="block text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-zinc-400" />
                    <span>Outlet Address</span>
                  </span>
                  <div className="text-sm text-zinc-800 font-medium">
                    {storeDetails?.address || 'No store address specified.'}
                  </div>
                </div>
              </div>

              {/* Registration Meta */}
              {storeDetails?.created_at && (
                <div className="pt-4 border-t border-zinc-100 flex items-center gap-2 text-xs text-zinc-400">
                  <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                  <span>
                    Store account created on{' '}
                    {new Date(storeDetails.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>

            {/* Quick Actions Card */}
            <div className="bg-white border border-zinc-200 rounded-xl p-6 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700 pb-2 border-b border-zinc-200">
                Account &amp; Security Controls
              </h2>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-zinc-200 bg-zinc-50">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-black flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-zinc-700" />
                    <span>Change Account Password</span>
                  </div>
                  <p className="text-xs text-zinc-500">
                    Update the credentials used to log in to this store terminal
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPasswordError(null);
                    setPasswordSuccess(null);
                    setIsPasswordModalOpen(true);
                  }}
                  className="ui-btn ui-btn-primary ui-btn-sm px-4 py-2 text-xs font-bold rounded-lg shadow-xs cursor-pointer whitespace-nowrap"
                >
                  Change Password
                </button>
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-lg border border-rose-200 bg-rose-50/50">
                <div className="space-y-0.5">
                  <div className="text-sm font-bold text-rose-900 flex items-center gap-1.5">
                    <LogOut className="w-4 h-4 text-rose-700" />
                    <span>Logout of Store Portal</span>
                  </div>
                  <p className="text-xs text-rose-700">
                    Sign out of this store session on this browser
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  disabled={loggingOut}
                  className="ui-btn ui-btn-outline ui-btn-sm px-4 py-2 text-xs font-bold rounded-lg border-rose-300 text-rose-700 bg-white hover:bg-rose-50 cursor-pointer shadow-xs disabled:opacity-50 whitespace-nowrap"
                >
                  {loggingOut ? 'Logging out...' : 'Sign Out Now'}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Overscreen Small Section Modal: Change Password */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => {
              if (!passwordSaving) {
                setIsPasswordModalOpen(false);
              }
            }}
            aria-hidden="true"
          />

          {/* Overscreen small modal card */}
          <div className="relative bg-white rounded-2xl border border-zinc-300 shadow-2xl w-full max-w-md p-6 z-50 space-y-5 anim-scale-in">
            {/* Modal Header with Close Button */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-zinc-100 rounded-lg text-black">
                  <KeyRound className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-black tracking-tight">
                  Change Password
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                disabled={passwordSaving}
                className="text-zinc-400 hover:text-black p-1 rounded-md cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Feedback Messages */}
            {passwordError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700 font-medium">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}
            {passwordSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-xs text-emerald-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            {/* Change Password Form */}
            <form onSubmit={handleChangePassword} className="space-y-4">
              {/* 1. Current Password */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Current Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter existing password"
                    required
                    className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-lg w-full h-10 pr-9 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black cursor-pointer"
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* 2. Changing Password (New Password) */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Changing Password (New Password) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter at least 6 characters"
                    required
                    minLength={6}
                    className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-lg w-full h-10 pr-9 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black cursor-pointer"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* 3. Confirm Password */}
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    required
                    minLength={6}
                    className="ui-input text-xs text-black border border-zinc-300 focus:border-black rounded-lg w-full h-10 pr-9 bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-black cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPasswordModalOpen(false)}
                  disabled={passwordSaving}
                  className="ui-btn ui-btn-outline ui-btn-md px-4 py-2 text-xs font-semibold rounded-lg text-zinc-700 border-zinc-300 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="ui-btn ui-btn-primary ui-btn-md px-5 py-2 text-xs font-bold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{passwordSaving ? 'Updating...' : 'Save Password'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
