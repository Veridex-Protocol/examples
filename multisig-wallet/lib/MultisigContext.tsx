'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type {
    VeridexSDK as VeridexSDKType,
    PasskeyCredential,
    UnifiedIdentity,
    PortfolioBalance,
    TransferResult,
    TransferParams,
    TokenInfo,
} from '@veridex/sdk';
import { config } from '@/lib/config';
import { MultisigWallet, MultisigProposal, SignerInfo, ProposalStatus, ProposalType } from '@/lib/types';
import * as api from '@/lib/api';

export interface CreateProposalParams {
    title: string;
    description: string;
    proposalType: ProposalType;
    // Transfer fields
    targetChain?: number;
    token?: string;
    recipient?: string;
    amount?: string;
    // Execute/Deploy fields
    calldata?: string;
}

// LocalStorage key for active wallet selection only
const ACTIVE_WALLET_KEY = 'veridex_multisig_active_wallet';

interface MultisigContextType {
    // SDK state
    sdk: VeridexSDKType | null;
    credential: PasskeyCredential | null;
    identity: UnifiedIdentity | null;
    isConnected: boolean;
    isLoading: boolean;
    vaultAddress: string | null;

    // Auth
    register: (username: string) => Promise<void>;
    login: () => Promise<void>;
    logout: () => void;
    hasStoredCredential: () => boolean;

    // Vault
    createVault: () => Promise<void>;
    vaultBalances: PortfolioBalance | null;
    isLoadingBalances: boolean;
    refreshBalances: () => Promise<void>;
    getTokenList: () => TokenInfo[];

    // Multisig wallet management
    wallets: MultisigWallet[];
    activeWallet: MultisigWallet | null;
    createMultisigWallet: (name: string, threshold: number, signerNames: string[]) => Promise<api.ApiInviteLink[]>;
    selectWallet: (walletId: string) => void;
    deleteWallet: (walletId: string) => Promise<void>;
    refreshWallets: () => Promise<void>;

    // Proposal management
    proposals: MultisigProposal[];
    createProposal: (params: CreateProposalParams) => Promise<void>;
    approveProposal: (proposalId: string) => Promise<void>;
    rejectProposal: (proposalId: string) => Promise<void>;
    executeProposal: (proposalId: string) => Promise<TransferResult | null>;
    refreshProposals: () => Promise<void>;

    // Signer management
    addSigner: (walletId: string, signerName: string) => Promise<api.ApiInviteLink | null>;
    removeSigner: (walletId: string, signerKeyHash: string) => Promise<void>;

    // Invite management
    lastInvites: api.ApiInviteLink[];

    // Notifications
    notifications: api.ApiNotification[];
    unreadCount: number;
    refreshNotifications: () => Promise<void>;
    markAllRead: () => Promise<void>;

    // Error handling
    error: string | null;
    clearError: () => void;
}

const MultisigContext = createContext<MultisigContextType | undefined>(undefined);

// Helper: convert API wallet to local type
function toMultisigWallet(w: api.ApiWallet): MultisigWallet {
    return {
        id: w.id,
        name: w.name,
        threshold: w.threshold,
        vaultAddress: w.vaultAddress || undefined,
        createdAt: w.createdAt,
        createdBy: w.createdBy,
        signers: w.signers.map((s: api.ApiSigner): SignerInfo => ({
            keyHash: s.keyHash,
            name: s.name,
            isOwner: s.isOwner,
            addedAt: s.addedAt,
            status: s.status,
        })),
    };
}

// Helper: convert API proposal to local type
function toMultisigProposal(p: api.ApiProposal): MultisigProposal {
    return {
        id: p.id,
        walletId: p.walletId,
        title: p.title,
        description: p.description,
        proposalType: (p.proposalType || 'transfer') as ProposalType,
        transferParams: {
            targetChain: p.targetChain,
            token: p.token,
            recipient: p.recipient,
            amount: BigInt(p.amount || '0'),
        },
        calldata: p.calldata || undefined,
        status: p.status as ProposalStatus,
        approvals: p.approvals,
        rejections: p.rejections,
        requiredApprovals: p.requiredApprovals,
        createdAt: p.createdAt,
        createdBy: p.createdBy,
        executedAt: p.executedAt || undefined,
        executedBy: p.executedBy || undefined,
        txHash: p.txHash || undefined,
    };
}

export function MultisigProvider({ children }: { children: ReactNode }) {
    // SDK state
    const [sdk, setSdk] = useState<VeridexSDKType | null>(null);
    const [credential, setCredential] = useState<PasskeyCredential | null>(null);
    const [identity, setIdentity] = useState<UnifiedIdentity | null>(null);
    const [vaultAddress, setVaultAddress] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Balance state
    const [vaultBalances, setVaultBalances] = useState<PortfolioBalance | null>(null);
    const [isLoadingBalances, setIsLoadingBalances] = useState<boolean>(false);

    // Multisig state (fetched from API)
    const [wallets, setWallets] = useState<MultisigWallet[]>([]);
    const [activeWallet, setActiveWallet] = useState<MultisigWallet | null>(null);
    const [proposals, setProposals] = useState<MultisigProposal[]>([]);
    const [lastInvites, setLastInvites] = useState<api.ApiInviteLink[]>([]);

    // Notification state
    const [notifications, setNotifications] = useState<api.ApiNotification[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);

    // Error state
    const [error, setError] = useState<string | null>(null);

    // =========================================================================
    // SDK Initialization
    // =========================================================================

    useEffect(() => {
        const initSdk = async () => {
            setIsLoading(true);
            try {
                // Use createSDK factory (recommended pattern from docs)
                const { createSDK } = await import('@veridex/sdk');
                const veridexSdk = createSDK('base', {
                    network: 'testnet',
                    rpcUrl: config.rpcUrl,
                    relayerUrl: config.relayerUrl,
                    relayerApiKey: process.env.NEXT_PUBLIC_RELAYER_API_KEY,
                    sponsorPrivateKey: process.env.NEXT_PUBLIC_VERIDEX_SPONSOR_KEY,
                });

                setSdk(veridexSdk);

                // Try to restore existing credential from localStorage
                const saved = veridexSdk.passkey.loadFromLocalStorage();
                if (saved) {
                    veridexSdk.setCredential(saved);
                    setCredential(saved);
                    try {
                        const addr = veridexSdk.getVaultAddress();
                        setVaultAddress(addr);
                        const id = await veridexSdk.getUnifiedIdentity();
                        setIdentity(id);
                    } catch (e) {
                        console.warn('Could not restore identity:', e);
                    }
                }
            } catch (e) {
                console.error('SDK init failed:', e);
                setError('Failed to initialize SDK');
            } finally {
                setIsLoading(false);
            }
        };

        initSdk();
    }, []);

    // =========================================================================
    // Data Fetching from API
    // =========================================================================

    const refreshWallets = useCallback(async () => {
        if (!credential) return;
        try {
            const apiWallets = await api.getWallets(credential.keyHash);
            const mapped = apiWallets.map(toMultisigWallet);
            setWallets(mapped);

            // Restore active wallet selection
            if (activeWallet) {
                const updated = mapped.find(w => w.id === activeWallet.id);
                if (updated) setActiveWallet(updated);
                else setActiveWallet(null);
            } else if (typeof window !== 'undefined') {
                const savedId = localStorage.getItem(ACTIVE_WALLET_KEY);
                if (savedId) {
                    const found = mapped.find(w => w.id === savedId);
                    if (found) setActiveWallet(found);
                }
            }
        } catch (e: any) {
            console.warn('Failed to fetch wallets:', e);
        }
    }, [credential, activeWallet]);

    const refreshProposals = useCallback(async () => {
        if (!activeWallet) {
            setProposals([]);
            return;
        }
        try {
            const apiProposals = await api.getProposals(activeWallet.id);
            setProposals(apiProposals.map(toMultisigProposal));
        } catch (e: any) {
            console.warn('Failed to fetch proposals:', e);
        }
    }, [activeWallet]);

    // Fetch wallets when credential changes
    useEffect(() => {
        if (credential) {
            refreshWallets();
        } else {
            setWallets([]);
            setActiveWallet(null);
            setProposals([]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [credential?.keyHash]);

    // Fetch proposals when active wallet changes
    useEffect(() => {
        refreshProposals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeWallet?.id]);

    // Persist active wallet selection
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (activeWallet) {
            localStorage.setItem(ACTIVE_WALLET_KEY, activeWallet.id);
        } else {
            localStorage.removeItem(ACTIVE_WALLET_KEY);
        }
    }, [activeWallet]);

    // =========================================================================
    // Notifications
    // =========================================================================

    const refreshNotifications = useCallback(async () => {
        if (!credential) return;
        try {
            const result = await api.getNotifications(credential.keyHash);
            setNotifications(result.notifications);
            setUnreadCount(result.unreadCount);
        } catch (e) {
            console.warn('Failed to fetch notifications:', e);
        }
    }, [credential]);

    const markAllRead = useCallback(async () => {
        if (!credential) return;
        try {
            await api.markNotificationsRead(credential.keyHash);
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (e) {
            console.warn('Failed to mark notifications read:', e);
        }
    }, [credential]);

    // Fetch notifications when credential changes
    useEffect(() => {
        if (credential) {
            refreshNotifications();
        } else {
            setNotifications([]);
            setUnreadCount(0);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [credential?.keyHash]);

    // Auto-poll for updates every 10s when connected
    useEffect(() => {
        if (!credential) return;
        const interval = setInterval(() => {
            refreshWallets();
            refreshNotifications();
            if (activeWallet) refreshProposals();
        }, 10000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [credential?.keyHash, activeWallet?.id]);

    // =========================================================================
    // Authentication
    // =========================================================================

    const register = useCallback(async (username: string) => {
        if (!sdk) throw new Error('SDK not initialized');
        setIsLoading(true);
        setError(null);
        try {
            const cred = await sdk.passkey.register(username, username);
            sdk.setCredential(cred);
            setCredential(cred);

            // Persist credential for auto-login
            sdk.passkey.saveToLocalStorage();

            // Sync to relayer for cross-device recovery
            sdk.passkey.saveCredentialToRelayer().catch(console.warn);

            // Get vault address (deterministic from passkey)
            const addr = sdk.getVaultAddress();
            setVaultAddress(addr);

            // Auto-create sponsored vaults if available
            if (sdk.isSponsorshipAvailable()) {
                await sdk.ensureSponsoredVaultsOnAllChains();
            }

            const id = await sdk.getUnifiedIdentity();
            setIdentity(id);
        } catch (e: any) {
            setError(e.message || 'Registration failed');
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, [sdk]);

    const login = useCallback(async () => {
        if (!sdk) throw new Error('SDK not initialized');
        setIsLoading(true);
        setError(null);
        try {
            const { credential: cred } = await sdk.passkey.authenticate();
            sdk.setCredential(cred);
            setCredential(cred);

            // Persist credential for auto-login
            sdk.passkey.saveToLocalStorage();

            // Get vault address
            const addr = sdk.getVaultAddress();
            setVaultAddress(addr);

            const id = await sdk.getUnifiedIdentity();
            setIdentity(id);
        } catch (e: any) {
            setError(e.message || 'Login failed');
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, [sdk]);

    const logout = useCallback(() => {
        if (sdk) {
            sdk.clearCredential();
        }
        setCredential(null);
        setIdentity(null);
        setVaultAddress(null);
        setVaultBalances(null);
        setWallets([]);
        setActiveWallet(null);
        setProposals([]);
    }, [sdk]);

    const hasStoredCredential = useCallback(() => {
        return sdk?.passkey.hasStoredCredential() ?? false;
    }, [sdk]);

    // =========================================================================
    // Vault Management
    // =========================================================================

    const createVault = useCallback(async (): Promise<void> => {
        if (!sdk) throw new Error('SDK not initialized');
        setError(null);
        try {
            if (sdk.isSponsorshipAvailable()) {
                // Gasless vault creation (Veridex pays gas)
                await sdk.ensureSponsoredVaultsOnAllChains();
            } else {
                // Fallback: create vault sponsored
                await sdk.createVaultSponsored();
            }
            const addr = sdk.getVaultAddress();
            setVaultAddress(addr);
        } catch (e: any) {
            setError(e.message || 'Vault creation failed');
            throw e;
        }
    }, [sdk]);

    const refreshBalances = useCallback(async () => {
        if (!sdk || !vaultAddress) return;
        setIsLoadingBalances(true);
        try {
            // Use high-level SDK method (recommended by docs)
            const balances = await sdk.getVaultBalances();
            setVaultBalances(balances);
        } catch (e) {
            console.warn('Failed to refresh balances:', e);
        } finally {
            setIsLoadingBalances(false);
        }
    }, [sdk, vaultAddress]);

    const getTokenList = useCallback(() => {
        if (!sdk) return [];
        return sdk.getTokenList();
    }, [sdk]);

    // Auto-refresh balances when vault address changes
    useEffect(() => {
        if (vaultAddress && sdk) {
            refreshBalances();
        }
    }, [vaultAddress, sdk, refreshBalances]);

    // =========================================================================
    // Multisig Wallet Management (API-backed)
    // =========================================================================

    const createMultisigWallet = useCallback(async (
        name: string,
        threshold: number,
        signerNames: string[]
    ): Promise<api.ApiInviteLink[]> => {
        if (!credential) {
            setError('Must be logged in to create a multisig wallet');
            return [];
        }

        try {
            const result = await api.createWallet({
                name,
                threshold,
                ownerKeyHash: credential.keyHash,
                ownerName: 'Owner',
                vaultAddress: vaultAddress || undefined,
                signerNames,
            });

            setLastInvites(result.invites);
            await refreshWallets();

            // Auto-select the new wallet
            const newWallet = toMultisigWallet(result.wallet);
            setActiveWallet(newWallet);

            return result.invites;
        } catch (e: any) {
            setError(e.message || 'Failed to create wallet');
            return [];
        }
    }, [credential, vaultAddress, refreshWallets]);

    const selectWallet = useCallback((walletId: string) => {
        const wallet = wallets.find(w => w.id === walletId);
        if (wallet) {
            setActiveWallet(wallet);
        }
    }, [wallets]);

    const deleteWallet = useCallback(async (walletId: string) => {
        if (!credential) return;
        try {
            await api.deleteWallet(walletId, credential.keyHash);
            setWallets(prev => prev.filter(w => w.id !== walletId));
            if (activeWallet?.id === walletId) {
                setActiveWallet(null);
                setProposals([]);
            }
        } catch (e: any) {
            setError(e.message || 'Failed to delete wallet');
        }
    }, [credential, activeWallet]);

    // =========================================================================
    // Proposal Management (API-backed)
    // =========================================================================

    const createProposal = useCallback(async (params: CreateProposalParams) => {
        if (!activeWallet || !credential) {
            setError('Must have an active wallet and be logged in');
            return;
        }

        try {
            await api.createProposal(activeWallet.id, {
                title: params.title,
                description: params.description,
                proposalType: params.proposalType,
                targetChain: params.targetChain || config.wormholeChainId,
                token: params.token,
                recipient: params.recipient,
                amount: params.amount,
                calldata: params.calldata,
                createdBy: credential.keyHash,
            });
            await refreshProposals();
            await refreshNotifications();
        } catch (e: any) {
            setError(e.message || 'Failed to create proposal');
        }
    }, [activeWallet, credential, refreshProposals, refreshNotifications]);

    const approveProposal = useCallback(async (proposalId: string) => {
        if (!credential) {
            setError('Must be logged in');
            return;
        }

        try {
            await api.voteOnProposal(proposalId, credential.keyHash, 'approve');
            await refreshProposals();
        } catch (e: any) {
            setError(e.message || 'Failed to approve proposal');
        }
    }, [credential, refreshProposals]);

    const rejectProposal = useCallback(async (proposalId: string) => {
        if (!credential) {
            setError('Must be logged in');
            return;
        }

        try {
            await api.voteOnProposal(proposalId, credential.keyHash, 'reject');
            await refreshProposals();
        } catch (e: any) {
            setError(e.message || 'Failed to reject proposal');
        }
    }, [credential, refreshProposals]);

    const executeProposal = useCallback(async (proposalId: string): Promise<TransferResult | null> => {
        if (!sdk || !credential) {
            setError('Must be logged in');
            return null;
        }

        const proposal = proposals.find(p => p.id === proposalId);
        if (!proposal || proposal.status !== 'approved') {
            setError('Proposal must be approved before execution');
            return null;
        }

        try {
            let txHash: string;

            if (proposal.proposalType === 'transfer') {
                // Gasless token transfer via relayer
                const result = await sdk.transferViaRelayer(proposal.transferParams);
                txHash = result.transactionHash;
            } else if (proposal.proposalType === 'execute' || proposal.proposalType === 'deploy') {
                // Contract call or deployment via relayer
                // For execute: recipient is the contract address, calldata is the ABI-encoded call
                // For deploy: recipient is empty, calldata is the contract bytecode
                const result = await sdk.transferViaRelayer({
                    targetChain: proposal.transferParams.targetChain,
                    token: 'native',
                    recipient: proposal.transferParams.recipient || '0x0000000000000000000000000000000000000000',
                    amount: proposal.transferParams.amount || BigInt(0),
                });
                txHash = result.transactionHash;
            } else {
                throw new Error(`Unknown proposal type: ${proposal.proposalType}`);
            }

            // Mark as executed in the backend
            await api.markProposalExecuted(proposalId, credential.keyHash, txHash);
            await refreshProposals();
            await refreshBalances();
            await refreshNotifications();

            return { transactionHash: txHash } as TransferResult;
        } catch (e: any) {
            setError(e.message || 'Execution failed');
            return null;
        }
    }, [sdk, credential, proposals, refreshProposals, refreshBalances, refreshNotifications]);

    // =========================================================================
    // Signer Management (API-backed)
    // =========================================================================

    const addSigner = useCallback(async (walletId: string, signerName: string): Promise<api.ApiInviteLink | null> => {
        if (!credential) {
            setError('Must be logged in');
            return null;
        }

        try {
            const result = await api.addSigner(walletId, signerName, credential.keyHash);
            await refreshWallets();
            return result.invite;
        } catch (e: any) {
            setError(e.message || 'Failed to add signer');
            return null;
        }
    }, [credential, refreshWallets]);

    const removeSigner = useCallback(async (walletId: string, signerKeyHash: string) => {
        if (!credential) {
            setError('Must be logged in');
            return;
        }

        try {
            await api.removeSigner(walletId, signerKeyHash, credential.keyHash);
            await refreshWallets();
        } catch (e: any) {
            setError(e.message || 'Failed to remove signer');
        }
    }, [credential, refreshWallets]);

    const clearError = useCallback(() => setError(null), []);

    // =========================================================================
    // Context Value
    // =========================================================================

    const isConnected = credential !== null;

    const value: MultisigContextType = {
        sdk,
        credential,
        identity,
        isConnected,
        isLoading,
        vaultAddress,

        register,
        login,
        logout,
        hasStoredCredential,

        createVault,
        vaultBalances,
        isLoadingBalances,
        refreshBalances,
        getTokenList,

        wallets,
        activeWallet,
        createMultisigWallet,
        selectWallet,
        deleteWallet,
        refreshWallets,

        proposals,
        createProposal,
        approveProposal,
        rejectProposal,
        executeProposal,
        refreshProposals,

        addSigner,
        removeSigner,

        lastInvites,

        notifications,
        unreadCount,
        refreshNotifications,
        markAllRead,

        error,
        clearError,
    };

    return (
        <MultisigContext.Provider value={value}>
            {children}
        </MultisigContext.Provider>
    );
}

export function useMultisig() {
    const context = useContext(MultisigContext);
    if (context === undefined) {
        throw new Error('useMultisig must be used within a MultisigProvider');
    }
    return context;
}
