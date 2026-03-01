import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
    const phone = process.env.CALLMEBOT_PHONE;
    const apikey = process.env.CALLMEBOT_APIKEY;

    if (!phone || !apikey) {
        return NextResponse.json({ error: 'Variables CALLMEBOT_PHONE o CALLMEBOT_APIKEY no configuradas', phone: !!phone, apikey: !!apikey });
    }

    const msg = encodeURIComponent('🧪 Test desde Vercel - Pencas Hípicas funcionando!');
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${msg}&apikey=${apikey}`;

    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
        const text = await res.text();
        return NextResponse.json({
            ok: res.ok,
            status: res.status,
            response: text.substring(0, 500),
            phone_configured: phone.substring(0, 5) + '...',
            apikey_configured: apikey.substring(0, 3) + '...',
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message, type: err.name });
    }
}
