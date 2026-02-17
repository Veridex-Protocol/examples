'use client';

import { useMultisig } from '@/lib/MultisigContext';
import { SignerInfo } from '@/lib/types';

export function WalletList() {
    const { wallets, activeWallet, selectWallet, deleteWallet } = useMultisig();

    if (wallets.length === 0) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                <svg className="w-10 h-10 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
                <p className="text-gray-500 text-sm">No wallets yet. Create your first multisig wallet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {wallets.map((wallet) => (
                <button
                    key={wallet.id}
                    onClick={() => selectWallet(wallet.id)}
                    className={`w-full text-left bg-gray-900 border rounded-xl p-4 transition-all group ${
                        activeWallet?.id === wallet.id
                            ? 'border-blue-500 ring-1 ring-blue-500/30'
                            : 'border-gray-800 hover:border-gray-700'
                    }`}
                >
                    <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">{wallet.name}</h3>
                            <p className="text-xs text-gray-500 mt-1">
                                {wallet.threshold}-of-{wallet.signers.length} signers
                            </p>
                        </div>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (confirm('Delete this wallet?')) {
                                    deleteWallet(wallet.id);
                                }
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-1"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </button>
                    </div>
                    <div className="flex items-center gap-1.5 mt-3">
                        {wallet.signers.map((signer: SignerInfo) => (
                            <div
                                key={signer.keyHash}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium ${
                                    signer.isOwner
                                        ? 'bg-blue-600 text-white'
                                        : signer.status === 'active'
                                            ? 'bg-green-600 text-white'
                                            : signer.status === 'invited'
                                                ? 'bg-yellow-600/50 text-yellow-200'
                                                : 'bg-gray-700 text-gray-300'
                                }`}
                                title={`${signer.name} (${signer.status || 'active'})`}
                            >
                                {signer.name.charAt(0).toUpperCase()}
                            </div>
                        ))}
                    </div>
                </button>
            ))}
        </div>
    );
}
