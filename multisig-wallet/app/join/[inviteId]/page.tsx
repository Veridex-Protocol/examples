'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMultisig } from '@/lib/MultisigContext';
import * as api from '@/lib/api';

export default function JoinWalletPage() {
    const params = useParams();
    const router = useRouter();
    const inviteId = params.inviteId as string;

    const { sdk, credential, isConnected, isLoading: sdkLoading, register, login } = useMultisig();

    const [inviteDetails, setInviteDetails] = useState<api.ApiInviteDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [joining, setJoining] = useState(false);
    const [joined, setJoined] = useState(false);
    const [username, setUsername] = useState('');
    const [authMode, setAuthMode] = useState<'register' | 'login'>('register');

    // Fetch invite details
    useEffect(() => {
        if (!inviteId) return;
        setLoading(true);
        api.getInviteDetails(inviteId)
            .then(data => {
                setInviteDetails(data);
                if (data.invite.isUsed) {
                    setError('This invite has already been used.');
                } else if (data.invite.isExpired) {
                    setError('This invite has expired.');
                }
            })
            .catch((e: any) => {
                setError(e.message || 'Invite not found');
            })
            .finally(() => setLoading(false));
    }, [inviteId]);

    const handleRegister = async () => {
        if (!username.trim()) return;
        try {
            await register(username.trim());
        } catch {
            // Error handled by context
        }
    };

    const handleLogin = async () => {
        try {
            await login();
        } catch {
            // Error handled by context
        }
    };

    const handleJoin = async () => {
        if (!credential || !inviteId) return;
        setJoining(true);
        setError(null);
        try {
            await api.acceptInvite(inviteId, credential.keyHash);
            setJoined(true);
        } catch (e: any) {
            setError(e.message || 'Failed to join wallet');
        } finally {
            setJoining(false);
        }
    };

    // Loading state
    if (loading || sdkLoading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Loading invite...</p>
                </div>
            </div>
        );
    }

    // Error state (expired/used/not found)
    if (error && !inviteDetails) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold mb-2">Invalid Invite</h1>
                    <p className="text-gray-400 mb-6">{error}</p>
                    <button
                        onClick={() => router.push('/')}
                        className="bg-gray-800 hover:bg-gray-700 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Successfully joined
    if (joined) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="w-12 h-12 bg-green-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold mb-2">You&apos;re In!</h1>
                    <p className="text-gray-400 mb-2">
                        You&apos;ve joined <span className="text-white font-medium">{inviteDetails?.wallet.name}</span> as a signer.
                    </p>
                    <p className="text-sm text-gray-500 mb-6">
                        You can now vote on proposals and help manage this multisig wallet.
                    </p>
                    <button
                        onClick={() => router.push('/')}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-6 rounded-lg transition-colors"
                    >
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    if (!inviteDetails) return null;

    const { invite, wallet } = inviteDetails;

    return (
        <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-gray-800 text-center">
                    <div className="w-14 h-14 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-semibold">Join Multisig Wallet</h1>
                    <p className="text-sm text-gray-400 mt-1">
                        You&apos;ve been invited to join as a signer
                    </p>
                </div>

                {/* Wallet Info */}
                <div className="p-6 border-b border-gray-800">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Wallet</span>
                                <span className="text-white font-medium">{wallet.name}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Configuration</span>
                                <span className="text-white">{wallet.threshold}-of-{wallet.signerCount}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">Your Role</span>
                                <span className="text-blue-400">{invite.signerName}</span>
                            </div>
                        </div>

                        {/* Existing signers */}
                        <div className="mt-4 pt-3 border-t border-gray-700">
                            <p className="text-xs text-gray-500 mb-2">Current signers:</p>
                            <div className="flex flex-wrap gap-1.5">
                                {wallet.signers.map((s: { name: string; status: string; isOwner: boolean }, i: number) => (
                                    <span
                                        key={i}
                                        className={`text-xs px-2 py-0.5 rounded ${
                                            s.isOwner
                                                ? 'bg-blue-600/20 text-blue-400'
                                                : s.status === 'active'
                                                    ? 'bg-green-600/20 text-green-400'
                                                    : 'bg-gray-700 text-gray-400'
                                        }`}
                                    >
                                        {s.name}{s.isOwner ? ' (owner)' : ''}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Auth / Join */}
                <div className="p-6">
                    {error && (
                        <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-4">
                            {error}
                        </div>
                    )}

                    {!isConnected ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-400 text-center">
                                To join this wallet, you need to authenticate with a passkey.
                            </p>

                            {/* Tab toggle */}
                            <div className="flex bg-gray-800 rounded-lg p-1">
                                <button
                                    onClick={() => setAuthMode('register')}
                                    className={`flex-1 text-sm py-2 rounded-md transition-colors ${
                                        authMode === 'register'
                                            ? 'bg-gray-700 text-white'
                                            : 'text-gray-400 hover:text-gray-300'
                                    }`}
                                >
                                    New Passkey
                                </button>
                                <button
                                    onClick={() => setAuthMode('login')}
                                    className={`flex-1 text-sm py-2 rounded-md transition-colors ${
                                        authMode === 'login'
                                            ? 'bg-gray-700 text-white'
                                            : 'text-gray-400 hover:text-gray-300'
                                    }`}
                                >
                                    Existing Passkey
                                </button>
                            </div>

                            {authMode === 'register' ? (
                                <div className="space-y-3">
                                    <input
                                        type="text"
                                        placeholder="Choose a username"
                                        value={username}
                                        onChange={(e) => setUsername(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        onClick={handleRegister}
                                        disabled={!username.trim() || !sdk}
                                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                                    >
                                        Register Passkey
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleLogin}
                                    disabled={!sdk}
                                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                                >
                                    Sign In with Passkey
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                                <p className="text-sm text-gray-400">Authenticated as</p>
                                <p className="text-xs font-mono text-gray-300 mt-1">
                                    {credential?.keyHash.slice(0, 16)}...
                                </p>
                            </div>

                            <button
                                onClick={handleJoin}
                                disabled={joining || invite.isUsed || invite.isExpired}
                                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                            >
                                {joining ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        Joining...
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                                        </svg>
                                        Join as {invite.signerName}
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
