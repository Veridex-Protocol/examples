import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/wallets?keyHash=xxx — Get all wallets for a signer
export async function GET(request: NextRequest) {
    const keyHash = request.nextUrl.searchParams.get('keyHash');
    if (!keyHash) {
        return NextResponse.json({ error: 'keyHash is required' }, { status: 400 });
    }

    const wallets = await db.getWalletsForSigner(keyHash);
    const result = await Promise.all(wallets.map(async w => {
        const signers = await db.getSigners(w.id);
        return {
            ...w,
            signers: signers.map(s => ({
                keyHash: s.keyHash,
                name: s.name,
                isOwner: s.isOwner,
                status: s.status,
                addedAt: s.addedAt,
                joinedAt: s.joinedAt,
            })),
        };
    }));

    return NextResponse.json(result);
}

// POST /api/wallets — Create a new multisig wallet
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, threshold, ownerKeyHash, ownerName, vaultAddress, signerNames } = body;

        if (!name || !threshold || !ownerKeyHash) {
            return NextResponse.json({ error: 'name, threshold, and ownerKeyHash are required' }, { status: 400 });
        }

        const walletId = `msig_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const wallet = await db.createWallet({
            id: walletId,
            name,
            threshold,
            vault_address: vaultAddress || null,
            created_at: Date.now(),
            created_by: ownerKeyHash,
        });

        // Add owner as first signer
        await db.addSigner(walletId, ownerKeyHash, ownerName || 'Owner', true, 'active');

        // Create invites for additional signers
        const invites: db.DbInvite[] = [];
        if (signerNames && Array.isArray(signerNames)) {
            for (const sn of signerNames) {
                if (!sn.trim()) continue;
                const inviteId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const invite = await db.createInvite({
                    id: inviteId,
                    wallet_id: walletId,
                    signer_name: sn.trim(),
                    created_at: Date.now(),
                    expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
                    used_by: null,
                    used_at: null,
                });
                // Add placeholder signer
                await db.addSigner(walletId, `invite_${inviteId}`, sn.trim(), false, 'invited');
                invites.push(invite);
            }
        }

        const signers = await db.getSigners(walletId);

        return NextResponse.json({
            wallet: {
                ...wallet,
                signers: signers.map(s => ({
                    keyHash: s.keyHash,
                    name: s.name,
                    isOwner: s.isOwner,
                    status: s.status,
                    addedAt: s.addedAt,
                    joinedAt: s.joinedAt,
                })),
            },
            invites: invites.map(inv => ({
                id: inv.id,
                signerName: inv.signerName,
                expiresAt: inv.expiresAt,
                link: `/join/${inv.id}`,
            })),
        }, { status: 201 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message || 'Failed to create wallet' }, { status: 500 });
    }
}

// DELETE /api/wallets?id=xxx&keyHash=xxx — Delete a wallet (owner only)
export async function DELETE(request: NextRequest) {
    const id = request.nextUrl.searchParams.get('id');
    const keyHash = request.nextUrl.searchParams.get('keyHash');

    if (!id || !keyHash) {
        return NextResponse.json({ error: 'id and keyHash are required' }, { status: 400 });
    }

    const wallet = await db.getWallet(id);
    if (!wallet) {
        return NextResponse.json({ error: 'Wallet not found' }, { status: 404 });
    }
    if (wallet.createdBy !== keyHash) {
        return NextResponse.json({ error: 'Only the owner can delete this wallet' }, { status: 403 });
    }

    await db.deleteWallet(id);
    return NextResponse.json({ success: true });
}
