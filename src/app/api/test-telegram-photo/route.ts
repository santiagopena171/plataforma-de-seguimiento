import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pencashipicas.vercel.app';
    const photoUrl = `${appUrl}/api/daily-image/florida-jueves-26`;

    if (!token || !chatId) {
        return NextResponse.json({ error: 'TELEGRAM vars missing', token: !!token, chatId: !!chatId }, { status: 500 });
    }

    try {
        // Download the image
        const imgRes = await fetch(photoUrl);
        if (!imgRes.ok) {
            return NextResponse.json({ error: `Image fetch failed: ${imgRes.status}`, photoUrl }, { status: 500 });
        }
        const imgBlob = await imgRes.blob();
        const imgBytes = imgBlob.size;

        // Upload to Telegram
        const form = new FormData();
        form.append('chat_id', chatId);
        form.append('photo', imgBlob, 'resumen.png');
        form.append('caption', '🏇 Test imagen — florida-jueves-26');
        form.append('parse_mode', 'Markdown');

        const res = await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
            method: 'POST',
            body: form,
        });
        const json = await res.json();

        return NextResponse.json({
            photoUrl,
            imgBytes,
            telegram: json,
            sent: json.ok === true,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, stack: err.stack?.substring(0, 400) }, { status: 500 });
    }
}
