import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// POST /api/proposals/[proposalId]/execute — Mark proposal as executed
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ proposalId: string }> }
) {
    const { proposalId } = await params;
    const body = await request.json();
    const { executedBy, txHash } = body;

    if (!executedBy || !txHash) {
        return NextResponse.json({ error: 'executedBy and txHash are required' }, { status: 400 });
    }

    const proposal = await db.getProposal(proposalId);
    if (!proposal) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (proposal.status !== 'approved') {
        return NextResponse.json({ error: 'Only approved proposals can be executed' }, { status: 409 });
    }

    // Verify executor is an active signer
    const signers = await db.getSigners(proposal.walletId);
    const isSigner = signers.some(s => s.keyHash === executedBy && s.status === 'active');
    if (!isSigner) {
        return NextResponse.json({ error: 'Only active signers can execute' }, { status: 403 });
    }

    await db.updateProposalStatus(proposalId, 'executed', executedBy, txHash);

    // Notify all signers about the execution
    const wallet = await db.getWallet(proposal.walletId);
    await db.createNotificationsForSigners(
        proposal.walletId,
        executedBy,
        'proposal_executed',
        `Transaction executed: ${proposal.title}`,
        `The proposal "${proposal.title}" has been executed on-chain.${wallet ? ` Wallet: ${wallet.name}.` : ''} Tx: ${txHash.slice(0, 10)}...`,
        proposalId
    );

    return NextResponse.json({
        success: true,
        status: 'executed',
        txHash,
        executedBy,
        executedAt: Date.now(),
    });
}
