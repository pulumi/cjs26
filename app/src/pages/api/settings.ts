import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

// SSR endpoints:
//   GET    /api/settings → 200 application/json (saved settings), or 404 if
//                          none persisted. Public.
//   POST   /api/settings (application/json) → 204; persists settings.
//                                              Auth-gated.
//   DELETE /api/settings → 204; removes saved settings. Auth-gated.
//
// "Settings" here are the visual choices (color, character ramp, contrast,
// brightness, size) so other visitors see the photo the way the owner
// last saved it, not their own defaults.
export const prerender = false;

interface KVNamespace {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
}

const KEY = "current.settings";
const MAX_BYTES = 1024; // generous; the payload is a handful of fields

function store(): KVNamespace {
    return (env as { PHOTO_STORE: KVNamespace }).PHOTO_STORE;
}

export const GET: APIRoute = async () => {
    const data = await store().get(KEY);
    if (!data) return new Response(null, { status: 404 });
    return new Response(data, {
        status: 200,
        headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
        },
    });
};

export const POST: APIRoute = async ({ request, session }) => {
    const authed = (await session?.get<boolean>("authed")) === true;
    if (!authed) return jsonError(401, "unauthorized");

    const body = await request.text();
    if (body.length > MAX_BYTES) return jsonError(413, "too-large");
    try {
        JSON.parse(body); // validate
    } catch {
        return jsonError(400, "invalid-json");
    }

    await store().put(KEY, body);
    return new Response(null, { status: 204 });
};

export const DELETE: APIRoute = async ({ session }) => {
    const authed = (await session?.get<boolean>("authed")) === true;
    if (!authed) return jsonError(401, "unauthorized");
    await store().delete(KEY);
    return new Response(null, { status: 204 });
};

function jsonError(status: number, code: string): Response {
    return new Response(JSON.stringify({ error: code }), {
        status,
        headers: { "content-type": "application/json; charset=utf-8" },
    });
}
