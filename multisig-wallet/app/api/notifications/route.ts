import { NextRequest, NextResponse } from 'next/server';
import * as db from '@/lib/db';

// GET /api/notifications?keyHash=xxx — Get notifications for a signer
export async function GET(request: NextRequest) {
    const keyHash = request.nextUrl.searchParams.get('keyHash');
    if (!keyHash) {
        return NextResponse.json({ error: 'keyHash is required' }, { status: 400 });
    }

    const notifications = await db.getNotifications(keyHash, 50);
    const unreadCount = await db.getUnreadNotificationCount(keyHash);

    return NextResponse.json({
        notifications: notifications.map(n => ({
            id: n.id,
            walletId: n.walletId,
            proposalId: n.proposalId,
            type: n.type,
            title: n.title,
            message: n.message,
            isRead: n.isRead,
            createdAt: n.createdAt,
        })),
        unreadCount,
    });
}

// POST /api/notifications — Mark notifications as read
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { keyHash, notificationIds } = body;

    if (!keyHash) {
        return NextResponse.json({ error: 'keyHash is required' }, { status: 400 });
    }

    await db.markNotificationsRead(keyHash, notificationIds);

    return NextResponse.json({ success: true });
}
