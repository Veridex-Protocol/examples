import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// POST /api/proposals/[proposalId]/vote — Vote on a proposal
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ proposalId: string }> }
) {
    const { proposalId } = await params;
    const body = await request.json();
    const { voterKeyHash, vote } = body;

    if (!voterKeyHash || !vote) {
        return NextResponse.json({ error: 'voterKeyHash and vote are required' }, { status: 400 });
    }

    if (vote !== 'approve' && vote !== 'reject') {
        return NextResponse.json({ error: 'vote must be "approve" or "reject"' }, { status: 400 });
    }

    const proposal = await db.getProposal(proposalId);
    if (!proposal) {
        return NextResponse.json({ error: 'Proposal not found' }, { status: 404 });
    }

    if (proposal.status !== 'pending') {
        return NextResponse.json({ error: `Cannot vote on a ${proposal.status} proposal` }, { status: 409 });
    }

    // Verify voter is an active signer on the wallet
    const signers = await db.getSigners(proposal.walletId);
    const isSigner = signers.some(s => s.keyHash === voterKeyHash && s.status === 'active');
    if (!isSigner) {
        return NextResponse.json({ error: 'Only active signers can vote' }, { status: 403 });
    }

    // Check if already voted
    const existingVotes = await db.getVotes(proposalId);
    const alreadyVoted = existingVotes.some(v => v.voterKeyHash === voterKeyHash);
    if (alreadyVoted) {
        return NextResponse.json({ error: 'You have already voted on this proposal' }, { status: 409 });
    }

    // Cast vote
    await db.addVote(proposalId, voterKeyHash, vote);

    // Check if proposal should change status
    const wallet = await db.getWallet(proposal.walletId);
    if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const approvalCount = await db.getApprovalCount(proposalId);
    const rejectionCount = await db.getRejectionCount(proposalId);
    const totalSigners = signers.filter(s => s.status === 'active').length;
    const remainingVoters = totalSigners - approvalCount - rejectionCount;

    let newStatus = proposal.status;
    if (approvalCount >= wallet.threshold) {
        newStatus = 'approved';
        await db.updateProposalStatus(proposalId, 'approved');
        // Notify all signers that proposal is ready to execute
        await db.createNotificationsForSigners(
            proposal.walletId,
            '', // notify everyone including voter
            'proposal_approved',
            `Proposal approved: ${proposal.title}`,
            `The proposal "${proposal.title}" has reached the required ${wallet.threshold} approvals and is ready to execute.`,
            proposalId
        );
    } else if (remainingVoters + approvalCount < wallet.threshold) {
        // Not enough remaining voters to reach threshold
        newStatus = 'rejected';
        await db.updateProposalStatus(proposalId, 'rejected');
        await db.createNotificationsForSigners(
            proposal.walletId,
            '',
            'proposal_rejected',
            `Proposal rejected: ${proposal.title}`,
            `The proposal "${proposal.title}" has been rejected — not enough approvals possible.`,
            proposalId
        );
    } else {
        // Notify other signers about the vote
        await db.createNotificationsForSigners(
            proposal.walletId,
            voterKeyHash,
            'proposal_voted',
            `Vote cast on: ${proposal.title}`,
            `A signer ${vote === 'approve' ? 'approved' : 'rejected'} the proposal "${proposal.title}" (${approvalCount}/${wallet.threshold} approvals).`,
            proposalId
        );
    }

    const allVotes = await db.getVotes(proposalId);

    return NextResponse.json({
        status: newStatus,
        approvals: allVotes.filter(v => v.vote === 'approve').map(v => v.voterKeyHash),
        rejections: allVotes.filter(v => v.vote === 'reject').map(v => v.voterKeyHash),
        approvalCount,
        rejectionCount,
        requiredApprovals: wallet.threshold,
    });
}
