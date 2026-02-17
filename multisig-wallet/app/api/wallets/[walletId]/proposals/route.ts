import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/wallets/[walletId]/proposals — Get all proposals for a wallet
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ walletId: string }> }
) {
    const { walletId } = await params;
    const wallet = await db.getWallet(walletId);
    if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const proposals = await db.getProposalsForWallet(walletId);
    const result = await Promise.all(proposals.map(async p => {
        const votes = await db.getVotes(p.id);
        return {
            ...p,
            approvals: votes.filter(v => v.vote === 'approve').map(v => v.voterKeyHash),
            rejections: votes.filter(v => v.vote === 'reject').map(v => v.voterKeyHash),
        };
    }));

    return NextResponse.json(result);
}

// POST /api/wallets/[walletId]/proposals — Create a new proposal
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ walletId: string }> }
) {
    const { walletId } = await params;
    const body = await request.json();
    const { title, description, proposalType, targetChain, token, recipient, amount, calldata, createdBy } = body;

    // Validate based on proposal type
    const type = proposalType || 'transfer';
    if (!title || !createdBy) {
        return NextResponse.json({ error: 'title and createdBy are required' }, { status: 400 });
    }
    if (type === 'transfer' && (!recipient || !amount)) {
        return NextResponse.json({ error: 'recipient and amount are required for transfer proposals' }, { status: 400 });
    }
    if (type === 'execute' && (!recipient || !calldata)) {
        return NextResponse.json({ error: 'recipient (contract address) and calldata are required for execute proposals' }, { status: 400 });
    }
    if (type === 'deploy' && !calldata) {
        return NextResponse.json({ error: 'calldata (contract bytecode) is required for deploy proposals' }, { status: 400 });
    }

    const wallet = await db.getWallet(walletId);
    if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Verify the creator is a signer
    const signers = await db.getSigners(walletId);
    const isSigner = signers.some(s => s.keyHash === createdBy && s.status === 'active');
    if (!isSigner) {
        return NextResponse.json({ error: 'Only active signers can create proposals' }, { status: 403 });
    }

    const proposalId = `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const proposal = await db.createProposal({
        id: proposalId,
        wallet_id: walletId,
        title,
        description: description || '',
        proposal_type: type,
        target_chain: targetChain || 10004,
        token: token || 'native',
        recipient: recipient || '',
        amount: (amount || '0').toString(),
        calldata: calldata || null,
        status: 'pending',
        required_approvals: wallet.threshold,
        created_at: Date.now(),
        created_by: createdBy,
    });

    // Creator auto-approves
    await db.addVote(proposalId, createdBy, 'approve');

    // Check if threshold already met (e.g., 1-of-N)
    let status = proposal.status;
    const approvalCount = await db.getApprovalCount(proposalId);
    if (approvalCount >= wallet.threshold) {
        await db.updateProposalStatus(proposalId, 'approved');
        status = 'approved';
    }

    // Notify other signers about the new proposal
    await db.createNotificationsForSigners(
        walletId,
        createdBy,
        'proposal_created',
        `New proposal: ${title}`,
        `A new ${type} proposal "${title}" needs your approval in wallet "${wallet.name}".`,
        proposalId
    );

    const votes = await db.getVotes(proposalId);

    return NextResponse.json({
        ...proposal,
        status,
        approvals: votes.filter(v => v.vote === 'approve').map(v => v.voterKeyHash),
        rejections: votes.filter(v => v.vote === 'reject').map(v => v.voterKeyHash),
    }, { status: 201 });
}
