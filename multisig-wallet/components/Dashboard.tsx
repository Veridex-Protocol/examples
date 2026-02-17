'use client';

import { useState } from 'react';
import { useMultisig } from '@/lib/MultisigContext';
import { WalletList } from '@/components/WalletList';
import { CreateWalletModal } from '@/components/CreateWalletModal';
import { WalletDetail } from '@/components/WalletDetail';
import { ProposalList } from '@/components/ProposalList';
import { CreateProposalModal } from '@/components/CreateProposalModal';
import { VaultPanel } from '@/components/VaultPanel';
import { ReceivePanel } from '@/components/ReceivePanel';
import { NotificationBell } from '@/components/NotificationBell';
import { TransactionHistory } from '@/components/TransactionHistory';

type Tab = 'wallets' | 'proposals' | 'vault' | 'receive';

export function Dashboard() {
    const { credential, identity, vaultAddress, logout, activeWallet, error, clearError } = useMultisig();
    const [activeTab, setActiveTab] = useState<Tab>('wallets');
    const [showCreateWallet, setShowCreateWallet] = useState(false);
    const [showCreateProposal, setShowCreateProposal] = useState(false);

    const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
        {
            id: 'wallets',
            label: 'Wallets',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
            ),
        },
        {
            id: 'proposals',
            label: 'Proposals',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
            ),
        },
        {
            id: 'receive',
            label: 'Receive',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
            ),
        },
        {
            id: 'vault',
            label: 'Vault',
            icon: (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
            ),
        },
    ];

    return (
        <div className="min-h-screen">
            {/* Top Bar */}
            <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                            <h1 className="text-lg font-semibold">Veridex Multisig</h1>
                        </div>

                        <div className="flex items-center gap-4">
                            {vaultAddress && (
                                <div className="hidden sm:flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5 text-sm">
                                    <div className="w-2 h-2 bg-green-400 rounded-full" />
                                    <span className="text-gray-300 font-mono">
                                        {vaultAddress.slice(0, 6)}...{vaultAddress.slice(-4)}
                                    </span>
                                </div>
                            )}
                            <NotificationBell />
                            <button
                                onClick={logout}
                                className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1.5"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Error Banner */}
            {error && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
                    <div className="bg-red-900/30 border border-red-800 rounded-lg p-3 flex items-center justify-between">
                        <span className="text-red-300 text-sm">{error}</span>
                        <button onClick={clearError} className="text-red-400 hover:text-red-300">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Tab Navigation */}
                <div className="flex gap-1 bg-gray-900 rounded-xl p-1 mb-6 w-fit">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                activeTab === tab.id
                                    ? 'bg-gray-800 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-gray-300'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Tab Content */}
                {activeTab === 'wallets' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold">Multisig Wallets</h2>
                            <button
                                onClick={() => setShowCreateWallet(true)}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                            >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                New Wallet
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-1">
                                <WalletList />
                            </div>
                            <div className="lg:col-span-2">
                                {activeWallet ? (
                                    <WalletDetail />
                                ) : (
                                    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
                                        <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                        </svg>
                                        <p className="text-gray-500">Select a wallet or create a new one</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'proposals' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold">Transaction Proposals</h2>
                            {activeWallet && (
                                <button
                                    onClick={() => setShowCreateProposal(true)}
                                    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                    New Proposal
                                </button>
                            )}
                        </div>

                        {activeWallet ? (
                            <div className="space-y-8">
                                <ProposalList />
                                <TransactionHistory />
                            </div>
                        ) : (
                            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
                                <p className="text-gray-500">Select a wallet first to view proposals</p>
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'receive' && <ReceivePanel />}

                {activeTab === 'vault' && <VaultPanel />}
            </div>

            {/* Modals */}
            {showCreateWallet && (
                <CreateWalletModal onClose={() => setShowCreateWallet(false)} />
            )}
            {showCreateProposal && (
                <CreateProposalModal onClose={() => setShowCreateProposal(false)} />
            )}
        </div>
    );
}
