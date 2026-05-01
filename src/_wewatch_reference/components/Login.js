import React, { useState, useEffect } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Eye, EyeOff, Loader2, LogIn, AlertCircle, Shield, Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import useAdmin from '../hooks/useAdmin';
import { useAuth } from '../context/AuthContext';
import AdminSetup from './AdminSetup';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [checkingSetup, setCheckingSetup] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);

  // Forgot password state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const { verifyAdmin, sendPasswordReset, loading } = useAdmin();
  const { login } = useAuth();

  // Check if admin setup is needed
  useEffect(() => {
    const checkForAdmin = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'Admins'));
        setNeedsSetup(querySnapshot.empty);
      } catch (err) {
        console.error('Error checking for admin:', err);
      } finally {
        setCheckingSetup(false);
      }
    };
    checkForAdmin();
  }, []);

  const handleSetupComplete = () => {
    setNeedsSetup(false);
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess(false);

    if (!resetEmail.trim()) {
      setResetError('Email is required');
      return;
    }

    setResetLoading(true);
    const result = await sendPasswordReset(resetEmail);
    setResetLoading(false);

    if (result.success) {
      setResetSuccess(true);
    } else {
      setResetError(result.error);
    }
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setResetEmail('');
    setResetSuccess(false);
    setResetError('');
  };

  const handleShowForgotPassword = () => {
    setShowForgotPassword(true);
    setResetEmail(email); // Pre-fill with login email if entered
    setResetError('');
    setResetSuccess(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    const result = await verifyAdmin(email, password);

    if (result.success) {
      login(result.admin);
    } else {
      setError(result.error || 'Login failed. Please try again.');
    }
  };

  // Show loading while checking setup
  if (checkingSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <span className="text-3xl font-bold text-white">W</span>
          </div>
          <div className="flex items-center justify-center gap-3 text-gray-500">
            <Loader2 size={20} className="animate-spin" />
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show setup if no admin exists
  if (needsSetup) {
    return <AdminSetup onSetupComplete={handleSetupComplete} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-gray-100 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/50 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300/50 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <img
            src="/logo/logo_light_mode.png"
            alt="WeWatch Logo"
            className="h-24 mx-auto mb-4 rounded-2xl object-contain"
          />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">WeWatch Admin</h1>
          <p className="text-gray-500">Dog Monitoring System</p>
        </div>

        {/* Login Card / Forgot Password Card */}
        <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl shadow-xl p-6 sm:p-8">
          {showForgotPassword ? (
            <>
              {/* Forgot Password Header */}
              <div className="flex items-center gap-3 mb-6">
                <button
                  onClick={handleBackToLogin}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Reset Password</h2>
                  <p className="text-sm text-gray-500">Enter your email to receive a reset link</p>
                </div>
              </div>

              {/* Success Message */}
              {resetSuccess && (
                <div className="flex items-center gap-3 p-3 mb-6 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
                  <p className="text-sm text-green-600">
                    If an account exists with this email, a reset link will be sent.
                  </p>
                </div>
              )}

              {/* Error Message */}
              {resetError && (
                <div className="flex items-center gap-3 p-3 mb-6 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-600">{resetError}</p>
                </div>
              )}

              {!resetSuccess ? (
                <form onSubmit={handleForgotPassword} className="space-y-5">
                  {/* Email Field */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        className="w-full px-4 py-3 pl-11 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                        placeholder="admin@wewatch.com"
                        disabled={resetLoading}
                      />
                      <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
                  >
                    {resetLoading ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail size={18} />
                        Send Reset Link
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <button
                  onClick={handleBackToLogin}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-all"
                >
                  <ArrowLeft size={18} />
                  Back to Login
                </button>
              )}

              {/* Footer */}
              <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-500">
                  Multan Division Administration
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Shield size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Admin Login</h2>
                  <p className="text-sm text-gray-500">Enter your credentials to continue</p>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="flex items-center gap-3 p-3 mb-6 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                    placeholder="admin@wewatch.com"
                    disabled={loading}
                  />
                </div>

                {/* Password Field */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-3 pr-12 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      placeholder="Enter your password"
                      disabled={loading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <LogIn size={18} />
                      Sign In
                    </>
                  )}
                </button>
              </form>

              {/* Forgot Password Link */}
              <div className="mt-4 text-center">
                <button
                  onClick={handleShowForgotPassword}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                >
                  Forgot your password?
                </button>
              </div>

              {/* Footer */}
              <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-500">
                  Multan Division Administration
                </p>
              </div>
            </>
          )}
        </div>

        {/* Copyright */}
        <p className="text-center text-xs text-gray-500 mt-6">
          &copy; {new Date().getFullYear()} WeWatch. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
