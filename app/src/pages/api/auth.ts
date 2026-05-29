import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

// SSR endpoints:
//   POST   /api/auth { password } → 200 + sets the authed session flag, or 401.
//   DELETE /api/auth              → 204; destroys the session ("lock").
export const prerender = false;

interface KVNamespace {
    put(key: string, value: string): Promise<void>;
}

// Key written on first successful auth. index.astro checks for any keys
// in PHOTO_STORE to decide whether the card has been claimed.
const CLAIMED_KEY = "claimed";

export const POST: APIRoute = async ({ request, session }) => {
    let body: { password?: string };
    try {
        body = (await request.json()) as { password?: string };
    } catch {
        return jsonError(400, "invalid-json");
    }

    const expected = (env as { PASSKEY?: string }).PASSKEY;
    if (!expected) {
        return jsonError(500, "server-not-configured");
    }
    if (
        typeof body.password !== "string" ||
        !timingSafeEqual(body.password, expected)
    ) {
        return jsonError(401, "invalid-password");
    }

    await session?.set("authed", true);
    // Mark the card claimed so future visitors don't see the Edit prompt,
    // even if the owner signs out before saving anything. Best-effort —
    // idempotent put, missing binding is a no-op.
    const photoStore = (env as { PHOTO_STORE?: KVNamespace }).PHOTO_STORE;
    if (photoStore) {
        await photoStore.put(CLAIMED_KEY, "1");
    }
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
    });
};

export const DELETE: APIRoute = async ({ session }) => {
    // Best-effort: drop the authed flag, then destroy the session record so
    // the underlying KV entry is removed too.
    await session?.set("authed", false);
    await session?.destroy?.();
    return new Response(null, { status: 204 });
};

function jsonError(status: number, code: string): Response {
    return new Response(JSON.stringify({ error: code }), {
        status,
        headers: { "content-type": "application/json; charset=utf-8" },
    });
}

// Constant-time string comparison so an attacker can't infer the password
// length via response timing. Short-circuiting is fine for length itself.
function timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++)
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
}
