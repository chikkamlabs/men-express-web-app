'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { signInWithSupabase, getCurrentSupabaseUser } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function checkExisting() {
      const { user, role } = await getCurrentSupabaseUser();
      if (!isMounted) return;
      if (user && role === 'admin') {
        router.push('/admin/dashboard');
      } else if (user && role === 'store') {
        router.push('/store/dashboard');
      }
    }
    checkExisting();
    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please enter your email.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      // Authenticate with Supabase Auth and identify user role
      const { role } = await signInWithSupabase(email.trim(), password);

      if (role === 'admin') {
        router.push('/admin/dashboard');
      } else {
        router.push('/store/dashboard');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid login credentials.';
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="layout-page-container layout-flex-center anim-page-enter p-4">
      <div className="w-full max-w-md">
        <div className="ui-card">
          <div className="ui-card-body p-6 sm:p-8">
            {/* Men Express Logo */}
            <div className="flex flex-col items-center justify-center text-center mb-6">
              <div className="relative w-24 h-24 mb-4">
                <Image
                  src="/menexpress_logo.png"
                  alt="Men Express Logo"
                  width={96}
                  height={96}
                  className="w-full h-full object-contain rounded-lg"
                  priority
                />
              </div>

              {/* Heading */}
              <h1 className="typo-page-title text-center text-xl sm:text-2xl md:text-3xl">
                Welcome to Men Express
              </h1>
            </div>

            {/* Error Message */}
            {error && (
              <div className="ui-badge ui-badge-danger w-full py-2 px-3 mb-4 text-center justify-center text-xs sm:text-sm">
                <span>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} noValidate>
              {/* Email Input */}
              <div className="ui-form-group">
                <label htmlFor="email" className="ui-form-label">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="ui-input"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (error) setError(null);
                  }}
                  autoComplete="email"
                  required
                />
              </div>

              {/* Password Input with Eye button toggle */}
              <div className="ui-form-group">
                <label htmlFor="password" className="ui-form-label">
                  Password
                </label>
                <div className="relative flex items-center w-full">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="ui-input pr-10"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError(null);
                    }}
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 p-1 text-zinc-500 hover:text-black focus:outline-none transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'View password'}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-black" />
                    ) : (
                      <Eye className="w-4 h-4 text-black" />
                    )}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <div className="mt-6">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="ui-btn ui-btn-primary ui-btn-md w-full font-semibold"
                >
                  {isLoading ? 'Logging in...' : 'Login'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
