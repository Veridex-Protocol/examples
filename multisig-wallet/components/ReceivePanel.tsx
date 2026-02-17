'use client';

import { useState } from 'react';
import { useMultisig } from '@/lib/MultisigContext';
import { config } from '@/lib/config';

export function ReceivePanel() {
    const { vaultAddress, activeWallet, vaultBalances, isLoadingBalances, refreshBalances } = useMultisig();
    const [copied, setCopied] = useState(false);

    const displayAddress = activeWallet?.vaultAddress || vaultAddress;

    const handleCopy = async () => {
        if (!displayAddress) return;
        await navigator.clipboard.writeText(displayAddress);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Simple QR code using a public API (no extra dependency)
    const qrUrl = displayAddress
        ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(displayAddress)}&bgcolor=111827&color=ffffff&format=svg`
        : null;

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold">Receive Funds</h2>

            {/* Vault Address Card */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
                {displayAddress ? (
                    <div className="space-y-6">
                        {/* QR Code */}
                        <div className="flex flex-col items-center">
                            <div className="bg-white rounded-xl p-4 mb-4">
                                {qrUrl && (
                                    <img
                                        src={qrUrl}
                                        alt="Vault address QR code"
                                        width={200}
                                        height={200}
                                        className="rounded"
                                    />
                                )}
                            </div>
                            <p className="text-xs text-gray-500 text-center">
                                Scan this QR code to send funds to your vault
                            </p>
                        </div>

                        {/* Address Display */}
                        <div className="bg-gray-800/50 rounded-lg p-4">
                            <p className="text-xs text-gray-500 mb-2">Vault Address ({config.chainName})</p>
                            <div className="flex items-center gap-2">
                                <p className="font-mono text-sm break-all flex-1 text-gray-200">
                                    {displayAddress}
                                </p>
                                <button
                                    onClick={handleCopy}
                                    className="shrink-0 bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
                                >
                                    {copied ? (
                                        <>
                                            <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            Copied
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            Copy
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Explorer Link */}
                        <a
                            href={`${config.explorerUrl}/address/${displayAddress}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white py-3 px-4 rounded-lg transition-colors text-sm font-medium"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            View on {config.chainName} Explorer
                        </a>

                        {/* Current Balances */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-medium text-gray-300">Current Balances</h3>
                                <button
                                    onClick={refreshBalances}
                                    disabled={isLoadingBalances}
                                    className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                                >
                                    {isLoadingBalances ? 'Loading...' : 'Refresh'}
                                </button>
                            </div>
                            {vaultBalances && vaultBalances.tokens && vaultBalances.tokens.length > 0 ? (
                                <div className="space-y-2">
                                    {vaultBalances.tokens.map((token: any, i: number) => (
                                        <div key={i} className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3">
                                            <span className="text-sm text-gray-300">{token.symbol || 'Unknown'}</span>
                                            <span className="text-sm font-mono">{token.formattedBalance || '0'}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="bg-gray-800/50 rounded-lg p-4 text-center">
                                    <p className="text-sm text-gray-500">No balances yet</p>
                                    <p className="text-xs text-gray-600 mt-1">
                                        Send tokens to the address above to fund your vault.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <p className="text-gray-400 mb-2">No vault address available</p>
                        <p className="text-sm text-gray-500">
                            Register with a passkey and create a vault to receive funds.
                        </p>
                    </div>
                )}
            </div>

            {/* Info Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-green-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm">
                            <p className="font-medium text-gray-300 mb-1">Counterfactual Address</p>
                            <p className="text-gray-500">
                                Your vault address is deterministic. You can receive funds even before the vault contract is deployed.
                            </p>
                        </div>
                    </div>
                </div>
                <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm">
                            <p className="font-medium text-gray-300 mb-1">Same Address Everywhere</p>
                            <p className="text-gray-500">
                                This address is the same on all EVM chains (Base, Optimism, Arbitrum, etc.).
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Testnet Faucet Info */}
            <div className="bg-blue-900/20 border border-blue-800/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <div className="text-sm">
                        <p className="font-medium text-blue-300 mb-1">Testnet Faucets</p>
                        <p className="text-blue-400/70 mb-2">
                            Get free testnet tokens to try out the multisig wallet:
                        </p>
                        <div className="space-y-1">
                            <a
                                href="https://www.alchemy.com/faucets/base-sepolia"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline block"
                            >
                                Base Sepolia ETH Faucet (Alchemy)
                            </a>
                            <a
                                href="https://faucet.circle.com/"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-400 hover:text-blue-300 underline block"
                            >
                                USDC Testnet Faucet (Circle)
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
