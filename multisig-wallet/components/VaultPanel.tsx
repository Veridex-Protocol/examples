'use client';

import { useState } from 'react';
import { useMultisig } from '@/lib/MultisigContext';
import { config } from '@/lib/config';

export function VaultPanel() {
    const {
        vaultAddress,
        createVault,
        vaultBalances,
        isLoadingBalances,
        refreshBalances,
        identity,
        credential,
    } = useMultisig();
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    const handleCreateVault = async () => {
        setIsCreating(true);
        setCreateError(null);
        try {
            await createVault();
        } catch (e: any) {
            setCreateError(e.message || 'Failed to create vault');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">Vault Management</h2>

            {/* Identity Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-sm font-medium text-gray-400 mb-4">Your Identity</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Key Hash</span>
                        <span className="text-sm font-mono text-gray-300">
                            {credential?.keyHash
                                ? `${credential.keyHash.slice(0, 10)}...${credential.keyHash.slice(-6)}`
                                : '—'
                            }
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Credential ID</span>
                        <span className="text-sm font-mono text-gray-300">
                            {credential?.credentialId
                                ? `${credential.credentialId.slice(0, 12)}...`
                                : '—'
                            }
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Chain</span>
                        <span className="text-sm text-gray-300">{config.chainName}</span>
                    </div>
                </div>
            </div>

            {/* Vault Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                <h3 className="text-sm font-medium text-gray-400 mb-4">Vault</h3>

                {vaultAddress ? (
                    <div className="space-y-4">
                        {/* Vault Address */}
                        <div className="bg-gray-800/50 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-gray-500 mb-1">Vault Address</p>
                                    <p className="font-mono text-sm break-all">{vaultAddress}</p>
                                </div>
                                <button
                                    onClick={() => navigator.clipboard.writeText(vaultAddress)}
                                    className="text-gray-400 hover:text-white transition-colors p-2 shrink-0"
                                    title="Copy address"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                </button>
                            </div>
                            <a
                                href={`${config.explorerUrl}/address/${vaultAddress}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 mt-2 inline-flex items-center gap-1"
                            >
                                View on Explorer
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        </div>

                        {/* Balances */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-medium text-gray-300">Balances</h4>
                                <button
                                    onClick={refreshBalances}
                                    disabled={isLoadingBalances}
                                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors flex items-center gap-1"
                                >
                                    {isLoadingBalances ? (
                                        <div className="w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    )}
                                    Refresh
                                </button>
                            </div>

                            {isLoadingBalances && !vaultBalances ? (
                                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                                    <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                    <p className="text-xs text-gray-500">Loading balances...</p>
                                </div>
                            ) : vaultBalances && vaultBalances.tokens && vaultBalances.tokens.length > 0 ? (
                                <div className="space-y-2">
                                    {vaultBalances.tokens.map((token: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs font-medium">
                                                    {token.symbol?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{token.symbol || 'Unknown'}</p>
                                                    <p className="text-xs text-gray-500">{token.name || ''}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-medium">{token.formattedBalance || '0'}</p>
                                                {token.usdValue && (
                                                    <p className="text-xs text-gray-500">${token.usdValue.toFixed(2)}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                                    <p className="text-sm text-gray-500">No token balances found.</p>
                                    <p className="text-xs text-gray-600 mt-1">
                                        Send tokens to your vault address to get started.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-6">
                        <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <p className="text-gray-400 mb-2">No vault deployed yet</p>
                        <p className="text-sm text-gray-500 mb-4">
                            Create a gasless vault on {config.chainName} to start managing funds.
                        </p>

                        {createError && (
                            <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 text-red-300 text-sm mb-4">
                                {createError}
                            </div>
                        )}

                        <button
                            onClick={handleCreateVault}
                            disabled={isCreating}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white font-medium py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 mx-auto"
                        >
                            {isCreating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Creating Vault...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    Create Gasless Vault
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>

            {/* Info Card */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm text-gray-400">
                        <p className="font-medium text-gray-300 mb-1">About Veridex Vaults</p>
                        <p>
                            Vaults are smart contract wallets secured by your passkey. They support gasless
                            transactions via the Veridex relayer, meaning you don&apos;t need ETH to send tokens.
                            Each vault is deterministically derived from your passkey identity.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
