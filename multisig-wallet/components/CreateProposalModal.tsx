'use client';

import { useState } from 'react';
import { useMultisig } from '@/lib/MultisigContext';
import { ProposalType } from '@/lib/types';
import { config } from '@/lib/config';

interface CreateProposalModalProps {
    onClose: () => void;
}

const proposalTypes: { id: ProposalType; label: string; description: string; icon: string }[] = [
    { id: 'transfer', label: 'Transfer', description: 'Send tokens to an address', icon: '↗' },
    { id: 'execute', label: 'Contract Call', description: 'Execute a smart contract function', icon: '⚡' },
    { id: 'deploy', label: 'Deploy', description: 'Deploy a new smart contract', icon: '🚀' },
];

export function CreateProposalModal({ onClose }: CreateProposalModalProps) {
    const { createProposal, activeWallet } = useMultisig();
    const [proposalType, setProposalType] = useState<ProposalType>('transfer');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Transfer fields
    const [recipient, setRecipient] = useState('');
    const [amount, setAmount] = useState('');
    const [tokenAddress, setTokenAddress] = useState('native');

    // Execute/Deploy fields
    const [contractAddress, setContractAddress] = useState('');
    const [calldata, setCalldata] = useState('');
    const [ethValue, setEthValue] = useState('');

    const handleCreate = async () => {
        if (!title.trim()) return;
        setIsSubmitting(true);
        try {
            if (proposalType === 'transfer') {
                await createProposal({
                    title: title.trim(),
                    description: description.trim(),
                    proposalType: 'transfer',
                    targetChain: config.wormholeChainId,
                    token: tokenAddress,
                    recipient: recipient.trim(),
                    amount: BigInt(Math.floor(parseFloat(amount) * 1e18)).toString(),
                });
            } else if (proposalType === 'execute') {
                await createProposal({
                    title: title.trim(),
                    description: description.trim(),
                    proposalType: 'execute',
                    targetChain: config.wormholeChainId,
                    recipient: contractAddress.trim(),
                    amount: ethValue ? BigInt(Math.floor(parseFloat(ethValue) * 1e18)).toString() : '0',
                    calldata: calldata.trim(),
                });
            } else if (proposalType === 'deploy') {
                await createProposal({
                    title: title.trim(),
                    description: description.trim(),
                    proposalType: 'deploy',
                    targetChain: config.wormholeChainId,
                    recipient: '',
                    amount: ethValue ? BigInt(Math.floor(parseFloat(ethValue) * 1e18)).toString() : '0',
                    calldata: calldata.trim(),
                });
            }
            onClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const isTransferValid = proposalType === 'transfer' && title.trim() && recipient.trim() && amount.trim() && parseFloat(amount) > 0;
    const isExecuteValid = proposalType === 'execute' && title.trim() && contractAddress.trim() && calldata.trim();
    const isDeployValid = proposalType === 'deploy' && title.trim() && calldata.trim();
    const isValid = isTransferValid || isExecuteValid || isDeployValid;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-800">
                    <div>
                        <h2 className="text-lg font-semibold">New Proposal</h2>
                        {activeWallet && (
                            <p className="text-xs text-gray-500 mt-1">
                                For: {activeWallet.name} ({activeWallet.threshold}-of-{activeWallet.signers.length})
                            </p>
                        )}
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-5">
                    {/* Proposal Type Selector */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Proposal Type</label>
                        <div className="grid grid-cols-3 gap-2">
                            {proposalTypes.map((pt) => (
                                <button
                                    key={pt.id}
                                    onClick={() => setProposalType(pt.id)}
                                    className={`p-3 rounded-lg border text-center transition-all ${
                                        proposalType === pt.id
                                            ? 'border-blue-500 bg-blue-600/10 text-white'
                                            : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
                                    }`}
                                >
                                    <span className="text-lg block mb-1">{pt.icon}</span>
                                    <span className="text-xs font-medium block">{pt.label}</span>
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            {proposalTypes.find(pt => pt.id === proposalType)?.description}
                        </p>
                    </div>

                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Proposal Title</label>
                        <input
                            type="text"
                            placeholder={
                                proposalType === 'transfer' ? 'e.g., Pay developer bounty' :
                                proposalType === 'execute' ? 'e.g., Approve USDC spending' :
                                'e.g., Deploy new NFT contract'
                            }
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Description (optional)</label>
                        <textarea
                            placeholder="Describe the purpose of this proposal..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        />
                    </div>

                    {/* Transfer-specific fields */}
                    {proposalType === 'transfer' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Recipient Address</label>
                                <input
                                    type="text"
                                    placeholder="0x..."
                                    value={recipient}
                                    onChange={(e) => setRecipient(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Amount (ETH)</label>
                                <input
                                    type="number"
                                    placeholder="0.01"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    step="0.001"
                                    min="0"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Token</label>
                                <select
                                    value={tokenAddress}
                                    onChange={(e) => setTokenAddress(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="native">ETH (Native)</option>
                                    <option value="0x036CbD53842c5426634e7929541eC2318f3dCF7e">USDC (Base Sepolia)</option>
                                </select>
                            </div>
                        </>
                    )}

                    {/* Execute-specific fields */}
                    {proposalType === 'execute' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Contract Address</label>
                                <input
                                    type="text"
                                    placeholder="0x..."
                                    value={contractAddress}
                                    onChange={(e) => setContractAddress(e.target.value)}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Calldata (hex)</label>
                                <textarea
                                    placeholder="0x..."
                                    value={calldata}
                                    onChange={(e) => setCalldata(e.target.value)}
                                    rows={3}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    ABI-encoded function call. Use tools like Etherscan or cast to generate this.
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">ETH Value (optional)</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={ethValue}
                                    onChange={(e) => setEthValue(e.target.value)}
                                    step="0.001"
                                    min="0"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Amount of ETH to send with the contract call (for payable functions).
                                </p>
                            </div>
                        </>
                    )}

                    {/* Deploy-specific fields */}
                    {proposalType === 'deploy' && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">Contract Bytecode (hex)</label>
                                <textarea
                                    placeholder="0x608060405234801561001057600080fd5b50..."
                                    value={calldata}
                                    onChange={(e) => setCalldata(e.target.value)}
                                    rows={5}
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Compiled contract bytecode including constructor arguments. Get this from your build output (e.g., Hardhat, Foundry).
                                </p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">ETH Value (optional)</label>
                                <input
                                    type="number"
                                    placeholder="0"
                                    value={ethValue}
                                    onChange={(e) => setEthValue(e.target.value)}
                                    step="0.001"
                                    min="0"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </>
                    )}

                    {/* Summary */}
                    {isValid && (
                        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-800">
                            <h4 className="text-sm font-medium text-gray-300 mb-2">Proposal Summary</h4>
                            <div className="space-y-1.5 text-sm text-gray-400">
                                <p>Type: <span className="text-white font-medium capitalize">{proposalType}</span></p>
                                {proposalType === 'transfer' && (
                                    <>
                                        <p>Send <span className="text-white font-medium">{amount} {tokenAddress === 'native' ? 'ETH' : 'tokens'}</span></p>
                                        <p>To <span className="text-white font-mono text-xs">{recipient.slice(0, 10)}...{recipient.slice(-6)}</span></p>
                                    </>
                                )}
                                {proposalType === 'execute' && (
                                    <>
                                        <p>Call <span className="text-white font-mono text-xs">{contractAddress.slice(0, 10)}...{contractAddress.slice(-6)}</span></p>
                                        <p>Data: <span className="text-white font-mono text-xs">{calldata.slice(0, 20)}...</span></p>
                                    </>
                                )}
                                {proposalType === 'deploy' && (
                                    <p>Bytecode: <span className="text-white font-mono text-xs">{calldata.slice(0, 20)}... ({Math.floor(calldata.length / 2)} bytes)</span></p>
                                )}
                                <p>Requires <span className="text-white">{activeWallet?.threshold} approval{(activeWallet?.threshold ?? 0) > 1 ? 's' : ''}</span></p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t border-gray-800">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={!isValid || isSubmitting}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Creating...
                            </>
                        ) : (
                            'Create Proposal'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
