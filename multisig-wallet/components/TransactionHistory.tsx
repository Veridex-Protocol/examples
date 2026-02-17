'use client';

import { useMultisig } from '@/lib/MultisigContext';
import { MultisigProposal } from '@/lib/types';
import { config } from '@/lib/config';

export function TransactionHistory() {
    const { proposals } = useMultisig();

    const executedProposals = proposals
        .filter((p: MultisigProposal) => p.status === 'executed')
        .sort((a, b) => (b.executedAt || 0) - (a.executedAt || 0));

    if (executedProposals.length === 0) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
                <svg className="w-10 h-10 text-gray-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 text-sm">No executed transactions yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-400">Transaction History</h3>
            {executedProposals.map((proposal: MultisigProposal) => (
                <div
                    key={proposal.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4"
                >
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                <h4 className="text-sm font-medium truncate">{proposal.title}</h4>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                                    proposal.proposalType === 'transfer' ? 'bg-blue-600/20 text-blue-400' :
                                    proposal.proposalType === 'execute' ? 'bg-purple-600/20 text-purple-400' :
                                    'bg-orange-600/20 text-orange-400'
                                }`}>
                                    {proposal.proposalType === 'transfer' ? 'Transfer' :
                                     proposal.proposalType === 'execute' ? 'Call' : 'Deploy'}
                                </span>
                            </div>
                        </div>
                        <span className="text-[10px] text-gray-500 shrink-0 ml-2">
                            {proposal.executedAt ? new Date(proposal.executedAt).toLocaleDateString() : ''}
                        </span>
                    </div>

                    {/* Details */}
                    <div className="ml-6 space-y-1">
                        {proposal.proposalType === 'transfer' && (
                            <p className="text-xs text-gray-400">
                                Sent{' '}
                                <span className="text-gray-300 font-mono">
                                    {(() => {
                                        const wei = proposal.transferParams.amount;
                                        const eth = Number(wei) / 1e18;
                                        return eth >= 0.001 ? `${eth.toFixed(6)} ETH` : `${wei.toString()} wei`;
                                    })()}
                                </span>
                                {' '}to{' '}
                                <span className="text-gray-300 font-mono">
                                    {proposal.transferParams.recipient.slice(0, 8)}...{proposal.transferParams.recipient.slice(-4)}
                                </span>
                            </p>
                        )}
                        {proposal.proposalType === 'execute' && (
                            <p className="text-xs text-gray-400">
                                Called contract{' '}
                                <span className="text-gray-300 font-mono">
                                    {proposal.transferParams.recipient.slice(0, 8)}...{proposal.transferParams.recipient.slice(-4)}
                                </span>
                            </p>
                        )}
                        {proposal.proposalType === 'deploy' && (
                            <p className="text-xs text-gray-400">
                                Deployed contract ({proposal.calldata ? Math.floor(proposal.calldata.length / 2) : 0} bytes)
                            </p>
                        )}

                        {proposal.txHash && (
                            <a
                                href={`${config.explorerUrl}/tx/${proposal.txHash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                            >
                                <span className="font-mono">{proposal.txHash.slice(0, 10)}...{proposal.txHash.slice(-6)}</span>
                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                </svg>
                            </a>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}
