'use client';

import { useState } from 'react';
import { useMultisig } from '@/lib/MultisigContext';
import { multisigConfig } from '@/lib/config';
import { ApiInviteLink } from '@/lib/api';

interface CreateWalletModalProps {
    onClose: () => void;
}

export function CreateWalletModal({ onClose }: CreateWalletModalProps) {
    const { createMultisigWallet } = useMultisig();
    const [name, setName] = useState('');
    const [threshold, setThreshold] = useState(2);
    const [signerNames, setSignerNames] = useState<string[]>(['', '']);
    const [isCreating, setIsCreating] = useState(false);
    const [inviteLinks, setInviteLinks] = useState<ApiInviteLink[] | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const totalSigners = signerNames.length + 1;

    const handleAddSigner = () => {
        if (signerNames.length < multisigConfig.maxSigners - 1) {
            setSignerNames([...signerNames, '']);
        }
    };

    const handleRemoveSigner = (index: number) => {
        if (signerNames.length > 1) {
            const updated = signerNames.filter((_: string, i: number) => i !== index);
            setSignerNames(updated);
            if (threshold > updated.length + 1) {
                setThreshold(updated.length + 1);
            }
        }
    };

    const handleSignerNameChange = (index: number, value: string) => {
        const updated = [...signerNames];
        updated[index] = value;
        setSignerNames(updated);
    };

    const handleCreate = async () => {
        if (!name.trim()) return;
        const validSigners = signerNames.filter((s: string) => s.trim());
        if (validSigners.length < 1) return;

        setIsCreating(true);
        try {
            const invites = await createMultisigWallet(name.trim(), threshold, validSigners);
            if (invites.length > 0) {
                setInviteLinks(invites);
            } else {
                onClose();
            }
        } catch {
            // Error handled by context
        } finally {
            setIsCreating(false);
        }
    };

    const copyInviteLink = (invite: ApiInviteLink) => {
        const url = `${window.location.origin}${invite.link}`;
        navigator.clipboard.writeText(url);
        setCopiedId(invite.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const isValid = name.trim() && signerNames.filter((s: string) => s.trim()).length >= 1 && threshold >= 1 && threshold <= totalSigners;

    // Show invite links after creation
    if (inviteLinks) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg">
                    <div className="p-6 border-b border-gray-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-green-600/20 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold">Wallet Created!</h2>
                                <p className="text-sm text-gray-400">Share these invite links with your signers</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 space-y-3">
                        <p className="text-sm text-gray-400 mb-4">
                            Each signer needs to open their invite link, register a passkey, and join the wallet.
                            Links expire in 7 days.
                        </p>
                        {inviteLinks.map((invite: ApiInviteLink) => (
                            <div key={invite.id} className="bg-gray-800/50 rounded-lg p-4 border border-gray-800">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium">{invite.signerName}</span>
                                    <button
                                        onClick={() => copyInviteLink(invite)}
                                        className={`text-xs px-3 py-1 rounded-full transition-colors ${
                                            copiedId === invite.id
                                                ? 'bg-green-600/20 text-green-400'
                                                : 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30'
                                        }`}
                                    >
                                        {copiedId === invite.id ? 'Copied!' : 'Copy Link'}
                                    </button>
                                </div>
                                <p className="text-xs text-gray-500 font-mono break-all">
                                    {window.location.origin}{invite.link}
                                </p>
                            </div>
                        ))}
                    </div>

                    <div className="p-6 border-t border-gray-800">
                        <button
                            onClick={onClose}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <h2 className="text-lg font-semibold">Create Multisig Wallet</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Wallet Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Wallet Name</label>
                        <input
                            type="text"
                            placeholder="e.g., Team Treasury"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Threshold */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Approval Threshold
                        </label>
                        <div className="flex items-center gap-3">
                            <select
                                value={threshold}
                                onChange={(e) => setThreshold(Number(e.target.value))}
                                className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {Array.from({ length: totalSigners }, (_, i) => i + 1).map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
                            <span className="text-gray-400 text-sm">
                                of {totalSigners} signers required to approve
                            </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            You (the owner) are automatically included as a signer.
                        </p>
                    </div>

                    {/* Signers */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-gray-300">Additional Signers</label>
                            <button
                                onClick={handleAddSigner}
                                disabled={signerNames.length >= multisigConfig.maxSigners - 1}
                                className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 transition-colors"
                            >
                                + Add Signer
                            </button>
                        </div>
                        <div className="space-y-2">
                            {signerNames.map((sn: string, i: number) => (
                                <div key={i} className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder={`Signer ${i + 2} name`}
                                        value={sn}
                                        onChange={(e) => handleSignerNameChange(i, e.target.value)}
                                        className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {signerNames.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveSigner(i)}
                                            className="text-gray-500 hover:text-red-400 transition-colors px-2"
                                        >
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Summary */}
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-800">
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Summary</h4>
                        <div className="space-y-1 text-sm text-gray-400">
                            <p>Wallet: <span className="text-white">{name || '—'}</span></p>
                            <p>Configuration: <span className="text-white">{threshold}-of-{totalSigners}</span></p>
                            <p>Total signers: <span className="text-white">{totalSigners}</span> (you + {signerNames.filter((s: string) => s.trim()).length} others)</p>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t border-gray-800">
                    <button
                        onClick={onClose}
                        disabled={isCreating}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!isValid || isCreating}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {isCreating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Creating...
                            </>
                        ) : (
                            'Create Wallet'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
