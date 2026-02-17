import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/wallets/[walletId]/signers — Get signers for a wallet
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ walletId: string }> }
) {
    const { walletId } = await params;
    const wallet = await db.getWallet(walletId);
    if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    const signers = await db.getSigners(walletId);
    return NextResponse.json(signers.map(s => ({
        keyHash: s.keyHash,
        name: s.name,
        isOwner: s.isOwner,
        status: s.status,
        addedAt: s.addedAt,
        joinedAt: s.joinedAt,
    })));
}

// POST /api/wallets/[walletId]/signers — Add a new signer (creates invite)
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ walletId: string }> }
) {
    const { walletId } = await params;
    const body = await request.json();
    const { signerName, requestedBy } = body;

    if (!signerName || !requestedBy) {
        return NextResponse.json({ error: 'signerName and requestedBy are required' }, { status: 400 });
    }

    const wallet = await db.getWallet(walletId);
    if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Only owner can add signers
    if (wallet.createdBy !== requestedBy) {
        return NextResponse.json({ error: 'Only the owner can add signers' }, { status: 403 });
    }

    // Create invite
    const inviteId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const invite = await db.createInvite({
        id: inviteId,
        wallet_id: walletId,
        signer_name: signerName.trim(),
        created_at: Date.now(),
        expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
        used_by: null,
        used_at: null,
    });

    // Add placeholder signer
    await db.addSigner(walletId, `invite_${inviteId}`, signerName.trim(), false, 'invited');

    return NextResponse.json({
        invite: {
            id: invite.id,
            signerName: invite.signerName,
            expiresAt: invite.expiresAt,
            link: `/join/${invite.id}`,
        },
    }, { status: 201 });
}

// DELETE /api/wallets/[walletId]/signers — Remove a signer
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ walletId: string }> }
) {
    const { walletId } = await params;
    const keyHash = request.nextUrl.searchParams.get('keyHash');
    const requestedBy = request.nextUrl.searchParams.get('requestedBy');

    if (!keyHash || !requestedBy) {
        return NextResponse.json({ error: 'keyHash and requestedBy are required' }, { status: 400 });
    }

    const wallet = await db.getWallet(walletId);
    if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }

    if (wallet.createdBy !== requestedBy) {
        return NextResponse.json({ error: 'Only the owner can remove signers' }, { status: 403 });
    }

    await db.removeSigner(walletId, keyHash);
    return NextResponse.json({ success: true });
}
