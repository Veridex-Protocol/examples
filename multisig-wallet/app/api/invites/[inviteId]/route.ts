import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/invites/[inviteId] — Get invite details (for join page)
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ inviteId: string }> }
) {
    const { inviteId } = await params;
    const invite = await db.getInvite(inviteId);
    if (!invite) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    const wallet = await db.getWallet(invite.walletId);
    if (!wallet) {
        return NextResponse.json({ error: 'Wallet no longer exists' }, { status: 404 });
    }

    const signers = await db.getSigners(invite.walletId);
    const isExpired = Date.now() > invite.expiresAt;
    const isUsed = invite.usedBy !== null;

    return NextResponse.json({
        invite: {
            id: invite.id,
            signerName: invite.signerName,
            expiresAt: invite.expiresAt,
            isExpired,
            isUsed,
            usedBy: invite.usedBy,
        },
        wallet: {
            id: wallet.id,
            name: wallet.name,
            threshold: wallet.threshold,
            signerCount: signers.length,
            signers: signers.map(s => ({
                name: s.name,
                status: s.status,
                isOwner: s.isOwner,
            })),
        },
    });
}

// POST /api/invites/[inviteId] — Accept invite (join wallet as signer)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ inviteId: string }> }
) {
    const { inviteId } = await params;
    const body = await request.json();
    const { keyHash, displayName } = body;

    if (!keyHash) {
        return NextResponse.json({ error: 'keyHash is required (must be authenticated)' }, { status: 400 });
    }

    const invite = await db.getInvite(inviteId);
    if (!invite) {
        return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    if (invite.usedBy) {
        return NextResponse.json({ error: 'Invite has already been used' }, { status: 409 });
    }

    if (Date.now() > invite.expiresAt) {
        return NextResponse.json({ error: 'Invite has expired' }, { status: 410 });
    }

    const wallet = await db.getWallet(invite.walletId);
    if (!wallet) {
        return NextResponse.json({ error: 'Wallet no longer exists' }, { status: 404 });
    }

    // Check if this user is already a signer
    const existingSigners = await db.getSigners(invite.walletId);
    const alreadySigner = existingSigners.find(s => s.keyHash === keyHash);
    if (alreadySigner) {
        return NextResponse.json({ error: 'You are already a signer on this wallet' }, { status: 409 });
    }

    // Replace the placeholder signer with the real passkey identity
    const placeholderKey = `invite_${inviteId}`;
    await db.updateSignerKeyHash(invite.walletId, placeholderKey, keyHash);

    // Mark invite as used
    await db.useInvite(inviteId, keyHash);

    const updatedSigners = await db.getSigners(invite.walletId);

    return NextResponse.json({
        success: true,
        wallet: {
            id: wallet.id,
            name: wallet.name,
            threshold: wallet.threshold,
            signers: updatedSigners.map(s => ({
                keyHash: s.keyHash,
                name: s.name,
                isOwner: s.isOwner,
                status: s.status,
                addedAt: s.addedAt,
                joinedAt: s.joinedAt,
            })),
        },
    });
}
