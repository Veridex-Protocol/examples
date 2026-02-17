import { prisma } from '@/lib/prisma';
import type { Wallet, Signer, Invite, Proposal, ProposalVote, Notification } from '@/lib/generated/prisma';

// ============================================================================
// Re-export Prisma types as Db* aliases for backward compatibility
// ============================================================================

export type DbWallet = Wallet;
export type DbSigner = Signer;
export type DbInvite = Invite;
export type DbProposal = Proposal;
export type DbVote = ProposalVote;
export type DbNotification = Notification;

// ============================================================================
// Wallet Operations
// ============================================================================

export function createWallet(wallet: {
    id: string;
    name: string;
    threshold: number;
    vault_address?: string | null;
    created_at: number;
    created_by: string;
}): Promise<DbWallet> {
    return prisma.wallet.create({
        data: {
            id: wallet.id,
            name: wallet.name,
            threshold: wallet.threshold,
            vaultAddress: wallet.vault_address ?? null,
            createdAt: wallet.created_at,
            createdBy: wallet.created_by,
        },
    });
}

export function getWallet(id: string): Promise<DbWallet | null> {
    return prisma.wallet.findUnique({ where: { id } });
}

export function getWalletsForSigner(keyHash: string): Promise<DbWallet[]> {
    return prisma.wallet.findMany({
        where: {
            signers: { some: { keyHash } },
        },
        orderBy: { createdAt: 'desc' },
    });
}

export function deleteWallet(id: string): Promise<DbWallet> {
    return prisma.wallet.delete({ where: { id } });
}

// ============================================================================
// Signer Operations
// ============================================================================

export async function addSigner(
    walletId: string,
    keyHash: string,
    name: string,
    isOwner: boolean,
    status: string = 'pending'
): Promise<void> {
    await prisma.signer.upsert({
        where: { walletId_keyHash: { walletId, keyHash } },
        update: {},
        create: {
            walletId,
            keyHash,
            name,
            isOwner,
            status,
            addedAt: Date.now(),
            joinedAt: isOwner ? Date.now() : null,
        },
    });
}

export function getSigners(walletId: string): Promise<DbSigner[]> {
    return prisma.signer.findMany({
        where: { walletId },
        orderBy: { addedAt: 'asc' },
    });
}

export async function updateSignerStatus(
    walletId: string,
    keyHash: string,
    status: string,
    joinedAt?: number
): Promise<void> {
    await prisma.signer.update({
        where: { walletId_keyHash: { walletId, keyHash } },
        data: {
            status,
            ...(joinedAt !== undefined ? { joinedAt } : {}),
        },
    });
}

export async function updateSignerKeyHash(
    walletId: string,
    oldKeyHash: string,
    newKeyHash: string
): Promise<void> {
    await prisma.signer.update({
        where: { walletId_keyHash: { walletId, keyHash: oldKeyHash } },
        data: {
            keyHash: newKeyHash,
            status: 'active',
            joinedAt: Date.now(),
        },
    });
}

export async function removeSigner(walletId: string, keyHash: string): Promise<void> {
    await prisma.signer.deleteMany({
        where: { walletId, keyHash, isOwner: false },
    });
}

// ============================================================================
// Invite Operations
// ============================================================================

export function createInvite(invite: {
    id: string;
    wallet_id: string;
    signer_name: string;
    created_at: number;
    expires_at: number;
    used_by?: string | null;
    used_at?: number | null;
}): Promise<DbInvite> {
    return prisma.invite.create({
        data: {
            id: invite.id,
            walletId: invite.wallet_id,
            signerName: invite.signer_name,
            createdAt: invite.created_at,
            expiresAt: invite.expires_at,
            usedBy: invite.used_by ?? null,
            usedAt: invite.used_at ?? null,
        },
    });
}

export function getInvite(id: string): Promise<DbInvite | null> {
    return prisma.invite.findUnique({ where: { id } });
}

export function getInvitesForWallet(walletId: string): Promise<DbInvite[]> {
    return prisma.invite.findMany({
        where: { walletId },
        orderBy: { createdAt: 'desc' },
    });
}

export async function useInvite(inviteId: string, usedBy: string): Promise<void> {
    await prisma.invite.update({
        where: { id: inviteId },
        data: { usedBy, usedAt: Date.now() },
    });
}

// ============================================================================
// Proposal Operations
// ============================================================================

export function createProposal(proposal: {
    id: string;
    wallet_id: string;
    title: string;
    description: string;
    proposal_type?: string;
    target_chain: number;
    token: string;
    recipient: string;
    amount: string;
    calldata?: string | null;
    status: string;
    required_approvals: number;
    created_at: number;
    created_by: string;
}): Promise<DbProposal> {
    return prisma.proposal.create({
        data: {
            id: proposal.id,
            walletId: proposal.wallet_id,
            title: proposal.title,
            description: proposal.description,
            proposalType: proposal.proposal_type || 'transfer',
            targetChain: proposal.target_chain,
            token: proposal.token,
            recipient: proposal.recipient,
            amount: proposal.amount,
            calldata: proposal.calldata ?? null,
            status: proposal.status,
            requiredApprovals: proposal.required_approvals,
            createdAt: proposal.created_at,
            createdBy: proposal.created_by,
        },
    });
}

export function getProposal(id: string): Promise<DbProposal | null> {
    return prisma.proposal.findUnique({ where: { id } });
}

export function getProposalsForWallet(walletId: string): Promise<DbProposal[]> {
    return prisma.proposal.findMany({
        where: { walletId },
        orderBy: { createdAt: 'desc' },
    });
}

export async function updateProposalStatus(
    id: string,
    status: string,
    executedBy?: string,
    txHash?: string
): Promise<void> {
    await prisma.proposal.update({
        where: { id },
        data: {
            status,
            ...(executedBy ? { executedBy, executedAt: Date.now() } : {}),
            ...(txHash ? { txHash } : {}),
        },
    });
}

// ============================================================================
// Vote Operations
// ============================================================================

export async function addVote(
    proposalId: string,
    voterKeyHash: string,
    vote: 'approve' | 'reject'
): Promise<void> {
    await prisma.proposalVote.upsert({
        where: { proposalId_voterKeyHash: { proposalId, voterKeyHash } },
        update: { vote, votedAt: Date.now() },
        create: { proposalId, voterKeyHash, vote, votedAt: Date.now() },
    });
}

export function getVotes(proposalId: string): Promise<DbVote[]> {
    return prisma.proposalVote.findMany({ where: { proposalId } });
}

export async function getApprovalCount(proposalId: string): Promise<number> {
    return prisma.proposalVote.count({
        where: { proposalId, vote: 'approve' },
    });
}

export async function getRejectionCount(proposalId: string): Promise<number> {
    return prisma.proposalVote.count({
        where: { proposalId, vote: 'reject' },
    });
}

// ============================================================================
// Notification Operations
// ============================================================================

export async function createNotification(notification: {
    recipient_key_hash: string;
    wallet_id: string;
    proposal_id: string | null;
    type: string;
    title: string;
    message: string;
    is_read: boolean | number;
    created_at: number;
}): Promise<void> {
    await prisma.notification.create({
        data: {
            recipientKeyHash: notification.recipient_key_hash,
            walletId: notification.wallet_id,
            proposalId: notification.proposal_id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            isRead: Boolean(notification.is_read),
            createdAt: notification.created_at,
        },
    });
}

export async function createNotificationsForSigners(
    walletId: string,
    excludeKeyHash: string,
    type: string,
    title: string,
    message: string,
    proposalId?: string
): Promise<void> {
    const signers = await getSigners(walletId);
    const targets = signers.filter(s => s.keyHash !== excludeKeyHash && s.status === 'active');
    for (const signer of targets) {
        await createNotification({
            recipient_key_hash: signer.keyHash,
            wallet_id: walletId,
            proposal_id: proposalId || null,
            type,
            title,
            message,
            is_read: false,
            created_at: Date.now(),
        });
    }
}

export function getNotifications(keyHash: string, limit: number = 50): Promise<DbNotification[]> {
    return prisma.notification.findMany({
        where: { recipientKeyHash: keyHash },
        orderBy: { createdAt: 'desc' },
        take: limit,
    });
}

export async function getUnreadNotificationCount(keyHash: string): Promise<number> {
    return prisma.notification.count({
        where: { recipientKeyHash: keyHash, isRead: false },
    });
}

export async function markNotificationsRead(keyHash: string, notificationIds?: number[]): Promise<void> {
    if (notificationIds && notificationIds.length > 0) {
        await prisma.notification.updateMany({
            where: {
                recipientKeyHash: keyHash,
                id: { in: notificationIds },
            },
            data: { isRead: true },
        });
    } else {
        await prisma.notification.updateMany({
            where: { recipientKeyHash: keyHash },
            data: { isRead: true },
        });
    }
}

// ============================================================================
// Transaction History
// ============================================================================

export function getTransactionHistory(walletId: string): Promise<DbProposal[]> {
    return prisma.proposal.findMany({
        where: { walletId, status: 'executed' },
        orderBy: { executedAt: 'desc' },
    });
}
