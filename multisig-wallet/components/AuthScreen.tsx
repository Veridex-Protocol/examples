'use client';

import { useState } from 'react';
import { useMultisig } from '@/lib/MultisigContext';

export function AuthScreen() {
    const { register, login, hasStoredCredential, error, clearError } = useMultisig();
    const [username, setUsername] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleRegister = async () => {
        if (!username.trim()) return;
        setIsRegistering(true);
        clearError();
        try {
            await register(username.trim());
        } catch {
            // Error handled by context
        } finally {
            setIsRegistering(false);
        }
    };

    const handleLogin = async () => {
        setIsLoggingIn(true);
        clearError();
        try {
            await login();
        } catch {
            // Error handled by context
        } finally {
            setIsLoggingIn(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        Multisig Wallet
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Powered by Veridex SDK with passkey authentication
                    </p>
                </div>

                {/* Auth Card */}
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-6">
                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm">
                            {error}
                        </div>
                    )}

                    {/* Register Section */}
                    <div className="space-y-3">
                        <h2 className="text-lg font-semibold">Create New Wallet</h2>
                        <p className="text-sm text-gray-400">
                            Register with a passkey to create your multisig wallet identity.
                        </p>
                        <input
                            type="text"
                            placeholder="Enter your username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button
                            onClick={handleRegister}
                            disabled={isRegistering || !username.trim()}
                            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            {isRegistering ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Registering...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                                    </svg>
                                    Register with Passkey
                                </>
                            )}
                        </button>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1 h-px bg-gray-700" />
                        <span className="text-gray-500 text-sm">or</span>
                        <div className="flex-1 h-px bg-gray-700" />
                    </div>

                    {/* Login Section */}
                    <div className="space-y-3">
                        <h2 className="text-lg font-semibold">Sign In</h2>
                        <p className="text-sm text-gray-400">
                            Use your existing passkey to access your multisig wallets.
                        </p>
                        <button
                            onClick={handleLogin}
                            disabled={isLoggingIn}
                            className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            {isLoggingIn ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Authenticating...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                    Sign In with Passkey
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-gray-600 text-xs mt-6">
                    Passkeys use your device&apos;s biometric authentication (Face ID, Touch ID, etc.)
                </p>
            </div>
        </div>
    );
}
