'use client';

import { useMultisig } from '@/lib/MultisigContext';
import { SignerInfo } from '@/lib/types';
import { ApiInviteLink } from '@/lib/api';
import { useState } from 'react';

const statusBadge: Record<string, { bg: string; text: string; label: string }> = {
    active: { bg: 'bg-green-600/20', text: 'text-green-400', label: 'Active' },
    invited: { bg: 'bg-yellow-600/20', text: 'text-yellow-400', label: 'Invited' },
    pending: { bg: 'bg-gray-600/20', text: 'text-gray-400', label: 'Pending' },
};

export function WalletDetail() {
    const { activeWallet, addSigner, removeSigner, credential } = useMultisig();
    const [newSignerName, setNewSignerName] = useState('');
    const [showAddSigner, setShowAddSigner] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [newInvite, setNewInvite] = useState<ApiInviteLink | null>(null);
    const [copied, setCopied] = useState(false);

    if (!activeWallet) return null;

    const isOwner = activeWallet.createdBy === credential?.keyHash;
    const activeSignerCount = activeWallet.signers.filter((s: SignerInfo) => s.status === 'active').length;

    const handleAddSigner = async () => {
        if (!newSignerName.trim() || !activeWallet) return;
        setIsAdding(true);
        try {
            const invite = await addSigner(activeWallet.id, newSignerName.trim());
            if (invite) {
                setNewInvite(invite);
            }
            setNewSignerName('');
            setShowAddSigner(false);
        } finally {
            setIsAdding(false);
        }
    };

    const copyInviteLink = () => {
        if (!newInvite) return;
        const url = `${window.location.origin}${newInvite.link}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-gray-800">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">{activeWallet.name}</h2>
                        <p className="text-sm text-gray-400 mt-1">
                            Requires {activeWallet.threshold} of {activeWallet.signers.length} approvals
                            ({activeSignerCount} active)
                        </p>
                    </div>
                    <div className="bg-blue-600/20 text-blue-400 text-xs font-medium px-3 py-1 rounded-full">
                        {activeWallet.threshold}-of-{activeWallet.signers.length}
                    </div>
                </div>
            </div>

            {/* New Invite Banner */}
            {newInvite && (
                <div className="p-4 bg-blue-900/20 border-b border-blue-800/30">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-blue-300">
                            Invite link for {newInvite.signerName}
                        </span>
                        <button
                            onClick={() => setNewInvite(null)}
                            className="text-gray-500 hover:text-gray-300 text-xs"
                        >
                            Dismiss
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-400 font-mono truncate flex-1">
                            {window.location.origin}{newInvite.link}
                        </p>
                        <button
                            onClick={copyInviteLink}
                            className={`text-xs px-3 py-1 rounded-full shrink-0 transition-colors ${
                                copied
                                    ? 'bg-green-600/20 text-green-400'
                                    : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                            }`}
                        >
                            {copied ? 'Copied!' : 'Copy'}
                        </button>
                    </div>
                </div>
            )}

            {/* Signers */}
            <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium text-gray-300">Signers</h3>
                    {isOwner && (
                        <button
                            onClick={() => setShowAddSigner(!showAddSigner)}
                            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                        >
                            + Invite Signer
                        </button>
                    )}
                </div>

                {/* Add Signer Form */}
                {showAddSigner && (
                    <div className="flex gap-2 mb-4">
                        <input
                            type="text"
                            placeholder="Signer name"
                            value={newSignerName}
                            onChange={(e) => setNewSignerName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddSigner()}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            onClick={handleAddSigner}
                            disabled={!newSignerName.trim() || isAdding}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                        >
                            {isAdding ? '...' : 'Invite'}
                        </button>
                        <button
                            onClick={() => { setShowAddSigner(false); setNewSignerName(''); }}
                            className="text-gray-400 hover:text-gray-300 text-sm px-3 py-2"
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {/* Signer List */}
                <div className="space-y-2">
                    {activeWallet.signers.map((signer: SignerInfo) => {
                        const status = statusBadge[signer.status || 'active'];
                        return (
                            <div
                                key={signer.keyHash}
                                className="flex items-center justify-between bg-gray-800/50 rounded-lg p-3"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                        signer.isOwner
                                            ? 'bg-blue-600 text-white'
                                            : signer.status === 'active'
                                                ? 'bg-green-600 text-white'
                                                : 'bg-gray-700 text-gray-300'
                                    }`}>
                                        {signer.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium">{signer.name}</p>
                                        <p className="text-xs text-gray-500 font-mono">
                                            {signer.status === 'invited'
                                                ? 'Awaiting invite acceptance'
                                                : signer.keyHash === credential?.keyHash
                                                    ? 'You'
                                                    : `${signer.keyHash.slice(0, 10)}...`
                                            }
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {signer.isOwner && (
                                        <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded">
                                            Owner
                                        </span>
                                    )}
                                    {!signer.isOwner && status && (
                                        <span className={`text-xs ${status.bg} ${status.text} px-2 py-0.5 rounded`}>
                                            {status.label}
                                        </span>
                                    )}
                                    {signer.keyHash === credential?.keyHash && !signer.isOwner && (
                                        <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded">
                                            You
                                        </span>
                                    )}
                                    {!signer.isOwner && isOwner && (
                                        <button
                                            onClick={() => removeSigner(activeWallet.id, signer.keyHash)}
                                            className="text-gray-500 hover:text-red-400 transition-colors p-1"
                                            title="Remove signer"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Threshold Info */}
                <div className="mt-4 p-3 bg-gray-800/30 rounded-lg border border-gray-800">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>
                            Transactions require {activeWallet.threshold} approval{activeWallet.threshold > 1 ? 's' : ''} from active signers.
                            Created {new Date(activeWallet.createdAt).toLocaleDateString()}.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
