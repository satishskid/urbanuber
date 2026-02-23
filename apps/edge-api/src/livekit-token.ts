/**
 * LiveKit Access Token Generator for Cloudflare Workers
 * 
 * Uses Web Crypto API (no Node.js dependencies) to generate JWT tokens
 * compatible with LiveKit's authentication scheme.
 */

interface VideoGrant {
    roomJoin?: boolean;
    room?: string;
    canPublish?: boolean;
    canSubscribe?: boolean;
    canPublishData?: boolean;
}

interface TokenClaims {
    iss: string;          // API key
    sub: string;          // participant identity
    exp: number;          // expiry
    nbf: number;          // not before
    iat: number;          // issued at
    jti: string;          // unique token ID
    name?: string;        // participant name
    video?: VideoGrant;
    metadata?: string;
}

function base64UrlEncode(data: Uint8Array): string {
    const base64 = btoa(String.fromCharCode(...data));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function strToBase64Url(str: string): string {
    return base64UrlEncode(new TextEncoder().encode(str));
}

export async function generateLiveKitToken(
    apiKey: string,
    apiSecret: string,
    roomName: string,
    participantIdentity: string,
    participantName?: string,
    ttlSeconds: number = 3600
): Promise<string> {
    const now = Math.floor(Date.now() / 1000);

    const claims: TokenClaims = {
        iss: apiKey,
        sub: participantIdentity,
        exp: now + ttlSeconds,
        nbf: now,
        iat: now,
        jti: crypto.randomUUID(),
        name: participantName || participantIdentity,
        video: {
            roomJoin: true,
            room: roomName,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        },
    };

    // JWT Header
    const header = { alg: 'HS256', typ: 'JWT' };
    const headerEncoded = strToBase64Url(JSON.stringify(header));
    const payloadEncoded = strToBase64Url(JSON.stringify(claims));

    // Sign with HMAC-SHA256 using Web Crypto
    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(apiSecret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(`${headerEncoded}.${payloadEncoded}`)
    );

    const signatureEncoded = base64UrlEncode(new Uint8Array(signature));

    return `${headerEncoded}.${payloadEncoded}.${signatureEncoded}`;
}
