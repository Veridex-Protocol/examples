import { TransferParams } from '@veridex/sdk';

export type ProposalType = 'transfer' | 'execute' | 'deploy';

export type ProposalStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'expired';

export type SignerStatus = 'active' | 'invited' | 'pending';

export interface SignerInfo {
    /** Passkey key hash or pending placeholder */
    keyHash: string;
    /** Display name for the signer */
    name: string;
    /** Timestamp when signer was added */
    addedAt: number;
    /** Whether this signer is the wallet owner/creator */
    isOwner: boolean;
    /** Signer status: active (joined), invited (link sent), pending (awaiting) */
    status?: SignerStatus;
}

export interface MultisigWallet {
    /** Unique wallet ID */
    id: string;
    /** Display name */
    name: string;
    /** Number of approvals required to execute a proposal */
    threshold: number;
    /** List of signers */
    signers: SignerInfo[];
    /** Associated vault address (if created) */
    vaultAddress?: string;
    /** Creation timestamp */
    createdAt: number;
    /** Key hash of the creator */
    createdBy: string;
}

export interface MultisigProposal {
    /** Unique proposal ID */
    id: string;
    /** Wallet this proposal belongs to */
    walletId: string;
    /** Proposal title */
    title: string;
    /** Proposal description */
    description: string;
    /** Type of proposal: transfer, execute (contract call), or deploy */
    proposalType: ProposalType;
    /** Transfer parameters to execute */
    transferParams: TransferParams;
    /** Calldata for execute/deploy proposals (hex-encoded) */
    calldata?: string;
    /** Current status */
    status: ProposalStatus;
    /** Key hashes of signers who approved */
    approvals: string[];
    /** Key hashes of signers who rejected */
    rejections: string[];
    /** Number of approvals required */
    requiredApprovals: number;
    /** Creation timestamp */
    createdAt: number;
    /** Key hash of the creator */
    createdBy: string;
    /** Execution timestamp (if executed) */
    executedAt?: number;
    /** Key hash of the executor */
    executedBy?: string;
    /** Transaction hash (if executed) */
    txHash?: string;
}
