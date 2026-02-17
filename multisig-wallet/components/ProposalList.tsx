'use client';

import { useMultisig } from '@/lib/MultisigContext';
import { MultisigProposal, ProposalStatus } from '@/lib/types';
import { useState } from 'react';

const statusColors: Record<ProposalStatus, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-600/20', text: 'text-yellow-400', label: 'Pending' },
    approved: { bg: 'bg-green-600/20', text: 'text-green-400', label: 'Approved' },
    rejected: { bg: 'bg-red-600/20', text: 'text-red-400', label: 'Rejected' },
    executed: { bg: 'bg-blue-600/20', text: 'text-blue-400', label: 'Executed' },
    expired: { bg: 'bg-gray-600/20', text: 'text-gray-400', label: 'Expired' },
};

export function ProposalList() {
    const {
        proposals,
        approveProposal,
        rejectProposal,
        executeProposal,
        credential,
        activeWallet,
    } = useMultisig();
    const [executingId, setExecutingId] = useState<string | null>(null);

    if (proposals.length === 0) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-12 text-center">
                <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-gray-500">No proposals yet for this wallet.</p>
                <p className="text-gray-600 text-sm mt-1">Create a proposal to initiate a transaction.</p>
            </div>
        );
    }

    const handleExecute = async (proposalId: string) => {
        setExecutingId(proposalId);
        try {
            await executeProposal(proposalId);
        } finally {
            setExecutingId(null);
        }
    };

    const hasApproved = (proposal: MultisigProposal) =>
        credential ? proposal.approvals.includes(credential.keyHash) : false;

    const hasRejected = (proposal: MultisigProposal) =>
        credential ? proposal.rejections.includes(credential.keyHash) : false;

    return (
        <div className="space-y-4">
            {proposals.map((proposal: MultisigProposal) => {
                const status = statusColors[proposal.status];
                const approved = hasApproved(proposal);
                const rejected = hasRejected(proposal);

                return (
                    <div
                        key={proposal.id}
                        className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
                    >
                        {/* Proposal Header */}
                        <div className="p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-medium">{proposal.title}</h3>
                                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                            proposal.proposalType === 'transfer' ? 'bg-blue-600/20 text-blue-400' :
                                            proposal.proposalType === 'execute' ? 'bg-purple-600/20 text-purple-400' :
                                            'bg-orange-600/20 text-orange-400'
                                        }`}>
                                            {proposal.proposalType === 'transfer' ? 'Transfer' :
                                             proposal.proposalType === 'execute' ? 'Contract Call' : 'Deploy'}
                                        </span>
                                    </div>
                                    {proposal.description && (
                                        <p className="text-sm text-gray-400">{proposal.description}</p>
                                    )}
                                </div>
                                <span className={`${status.bg} ${status.text} text-xs font-medium px-2.5 py-1 rounded-full ml-3 shrink-0`}>
                                    {status.label}
                                </span>
                            </div>

                            {/* Proposal Details */}
                            <div className="bg-gray-800/50 rounded-lg p-3 mb-4">
                                {proposal.proposalType === 'transfer' && (
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-gray-500">To</span>
                                            <p className="font-mono text-xs mt-0.5 truncate">
                                                {proposal.transferParams.recipient}
                                            </p>
                                        </div>
                                        <div>
                                            <span className="text-gray-500">Amount</span>
                                            <p className="font-mono text-xs mt-0.5">
                                                {(() => {
                                                    const wei = proposal.transferParams.amount;
                                                    const eth = Number(wei) / 1e18;
                                                    return eth >= 0.001 ? `${eth.toFixed(6)} ETH` : `${wei.toString()} wei`;
                                                })()}
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {proposal.proposalType === 'execute' && (
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="text-gray-500">Contract</span>
                                            <p className="font-mono text-xs mt-0.5 truncate">
                                                {proposal.transferParams.recipient}
                                            </p>
                                        </div>
                                        {proposal.calldata && (
                                            <div>
                                                <span className="text-gray-500">Calldata</span>
                                                <p className="font-mono text-xs mt-0.5 truncate text-gray-400">
                                                    {proposal.calldata.slice(0, 42)}...
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                                {proposal.proposalType === 'deploy' && (
                                    <div className="space-y-2 text-sm">
                                        <div>
                                            <span className="text-gray-500">Contract Deployment</span>
                                            <p className="text-xs mt-0.5 text-gray-400">
                                                Bytecode: {proposal.calldata ? `${Math.floor(proposal.calldata.length / 2)} bytes` : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Approval Progress */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                                    <span>Approvals: {proposal.approvals.length}/{proposal.requiredApprovals}</span>
                                    {proposal.rejections.length > 0 && (
                                        <span className="text-red-400">
                                            {proposal.rejections.length} rejection{proposal.rejections.length > 1 ? 's' : ''}
                                        </span>
                                    )}
                                </div>
                                <div className="w-full bg-gray-800 rounded-full h-2">
                                    <div
                                        className="bg-gradient-to-r from-blue-600 to-green-500 h-2 rounded-full transition-all"
                                        style={{
                                            width: `${Math.min(100, (proposal.approvals.length / proposal.requiredApprovals) * 100)}%`,
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Actions */}
                            {proposal.status === 'pending' && (
                                <div className="flex gap-2">
                                    {!approved && !rejected && (
                                        <>
                                            <button
                                                onClick={() => approveProposal(proposal.id)}
                                                className="flex-1 bg-green-600/20 hover:bg-green-600/30 text-green-400 text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => rejectProposal(proposal.id)}
                                                className="flex-1 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                                            >
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                                Reject
                                            </button>
                                        </>
                                    )}
                                    {approved && (
                                        <span className="text-xs text-green-400 flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                            You approved this proposal
                                        </span>
                                    )}
                                    {rejected && (
                                        <span className="text-xs text-red-400 flex items-center gap-1">
                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                            You rejected this proposal
                                        </span>
                                    )}
                                </div>
                            )}

                            {proposal.status === 'approved' && (
                                <button
                                    onClick={() => handleExecute(proposal.id)}
                                    disabled={executingId === proposal.id}
                                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:opacity-50 text-white text-sm font-medium py-2.5 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
                                >
                                    {executingId === proposal.id ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            Executing...
                                        </>
                                    ) : (
                                        <>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                            </svg>
                                            Execute Transaction
                                        </>
                                    )}
                                </button>
                            )}

                            {proposal.status === 'executed' && proposal.txHash && (
                                <div className="text-xs text-gray-400 flex items-center gap-1.5">
                                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>Tx: </span>
                                    <span className="font-mono">{proposal.txHash.slice(0, 10)}...{proposal.txHash.slice(-6)}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="px-5 py-3 bg-gray-800/30 border-t border-gray-800 text-xs text-gray-500">
                            Created {new Date(proposal.createdAt).toLocaleString()}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
