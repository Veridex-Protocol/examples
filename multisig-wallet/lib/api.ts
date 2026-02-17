// API client for the multisig wallet backend

const BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || `API error: ${res.status}`);
    }
    return data as T;
}

// ============================================================================
// Types (API response shapes)
// ============================================================================

export interface ApiSigner {
    keyHash: string;
    name: string;
    isOwner: boolean;
    status: 'active' | 'invited' | 'pending';
    addedAt: number;
    joinedAt: number | null;
}

export interface ApiWallet {
    id: string;
    name: string;
    threshold: number;
    vaultAddress: string | null;
    createdAt: number;
    createdBy: string;
    signers: ApiSigner[];
}

export interface ApiInviteLink {
    id: string;
    signerName: string;
    expiresAt: number;
    link: string;
}

export type ProposalType = 'transfer' | 'execute' | 'deploy';

export interface ApiProposal {
    id: string;
    walletId: string;
    title: string;
    description: string;
    proposalType: ProposalType;
    targetChain: number;
    token: string;
    recipient: string;
    amount: string;
    calldata: string | null;
    status: string;
    requiredApprovals: number;
    createdAt: number;
    createdBy: string;
    executedAt: number | null;
    executedBy: string | null;
    txHash: string | null;
    approvals: string[];
    rejections: string[];
}

export interface ApiNotification {
    id: number;
    walletId: string;
    proposalId: string | null;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: number;
}

export interface ApiInviteDetails {
    invite: {
        id: string;
        signerName: string;
        expiresAt: number;
        isExpired: boolean;
        isUsed: boolean;
        usedBy: string | null;
    };
    wallet: {
        id: string;
        name: string;
        threshold: number;
        signerCount: number;
        signers: { name: string; status: string; isOwner: boolean }[];
    };
}

// ============================================================================
// Wallet API
// ============================================================================

export async function getWallets(keyHash: string): Promise<ApiWallet[]> {
    return fetchJson<ApiWallet[]>(`${BASE}/wallets?keyHash=${encodeURIComponent(keyHash)}`);
}

export async function createWallet(params: {
    name: string;
    threshold: number;
    ownerKeyHash: string;
    ownerName: string;
    vaultAddress?: string;
    signerNames: string[];
}): Promise<{ wallet: ApiWallet; invites: ApiInviteLink[] }> {
    return fetchJson(`${BASE}/wallets`, {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

export async function deleteWallet(id: string, keyHash: string): Promise<void> {
    await fetchJson(`${BASE}/wallets?id=${encodeURIComponent(id)}&keyHash=${encodeURIComponent(keyHash)}`, {
        method: 'DELETE',
    });
}

// ============================================================================
// Signer API
// ============================================================================

export async function getSigners(walletId: string): Promise<ApiSigner[]> {
    return fetchJson<ApiSigner[]>(`${BASE}/wallets/${walletId}/signers`);
}

export async function addSigner(walletId: string, signerName: string, requestedBy: string): Promise<{ invite: ApiInviteLink }> {
    return fetchJson(`${BASE}/wallets/${walletId}/signers`, {
        method: 'POST',
        body: JSON.stringify({ signerName, requestedBy }),
    });
}

export async function removeSigner(walletId: string, keyHash: string, requestedBy: string): Promise<void> {
    await fetchJson(`${BASE}/wallets/${walletId}/signers?keyHash=${encodeURIComponent(keyHash)}&requestedBy=${encodeURIComponent(requestedBy)}`, {
        method: 'DELETE',
    });
}

// ============================================================================
// Invite API
// ============================================================================

export async function getInviteDetails(inviteId: string): Promise<ApiInviteDetails> {
    return fetchJson<ApiInviteDetails>(`${BASE}/invites/${inviteId}`);
}

export async function acceptInvite(inviteId: string, keyHash: string, displayName?: string): Promise<{ success: boolean; wallet: ApiWallet }> {
    return fetchJson(`${BASE}/invites/${inviteId}`, {
        method: 'POST',
        body: JSON.stringify({ keyHash, displayName }),
    });
}

// ============================================================================
// Proposal API
// ============================================================================

export async function getProposals(walletId: string): Promise<ApiProposal[]> {
    return fetchJson<ApiProposal[]>(`${BASE}/wallets/${walletId}/proposals`);
}

export async function createProposal(walletId: string, params: {
    title: string;
    description: string;
    proposalType?: ProposalType;
    targetChain: number;
    token?: string;
    recipient?: string;
    amount?: string;
    calldata?: string;
    createdBy: string;
}): Promise<ApiProposal> {
    return fetchJson(`${BASE}/wallets/${walletId}/proposals`, {
        method: 'POST',
        body: JSON.stringify(params),
    });
}

export async function voteOnProposal(proposalId: string, voterKeyHash: string, vote: 'approve' | 'reject'): Promise<{
    status: string;
    approvals: string[];
    rejections: string[];
}> {
    return fetchJson(`${BASE}/proposals/${proposalId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ voterKeyHash, vote }),
    });
}

export async function markProposalExecuted(proposalId: string, executedBy: string, txHash: string): Promise<void> {
    await fetchJson(`${BASE}/proposals/${proposalId}/execute`, {
        method: 'POST',
        body: JSON.stringify({ executedBy, txHash }),
    });
}

// ============================================================================
// Notification API
// ============================================================================

export async function getNotifications(keyHash: string): Promise<{ notifications: ApiNotification[]; unreadCount: number }> {
    return fetchJson(`${BASE}/notifications?keyHash=${encodeURIComponent(keyHash)}`);
}

export async function markNotificationsRead(keyHash: string, notificationIds?: number[]): Promise<void> {
    await fetchJson(`${BASE}/notifications`, {
        method: 'POST',
        body: JSON.stringify({ keyHash, notificationIds }),
    });
}
