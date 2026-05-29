import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

// SSR endpoints:
//   GET    /api/photo → 200 image/jpeg (current photo), or 404 if none stored.
//   POST   /api/photo (image/jpeg) → 204; stores under key `current`.
//   POST   /api/photo (image/png)  → 204; stores under key `current.og`
//                                    (the pre-rendered OG image).
//   DELETE /api/photo → 204; removes both keys.
// POST and DELETE require an authed session.
export const prerender = false;

interface KVNamespace {
    get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
    put(key: string, value: ArrayBuffer): Promise<void>;
    delete(key: string): Promise<void>;
}

const JPEG_KEY = "current";
const OG_KEY = "current.og";
const SETTINGS_KEY = "current.settings";
const MAX_BYTES = 2_000_000; // 2 MB safety cap (OG PNG can be ~500 KB)

function store(): KVNamespace {
    return (env as { PHOTO_STORE: KVNamespace }).PHOTO_STORE;
}

export const GET: APIRoute = async () => {
    const data = await store().get(JPEG_KEY, "arrayBuffer");
    if (!data) return new Response(null, { status: 404 });
    return new Response(data, {
        status: 200,
        headers: {
            "content-type": "image/jpeg",
            // KV's eventual consistency means a fresh write can take seconds to
            // propagate. Force the client to revalidate so we don't serve stale.
            "cache-control": "no-store",
        },
    });
};

export const POST: APIRoute = async ({ request, session }) => {
    const authed = (await session?.get<boolean>("authed")) === true;
    if (!authed) return jsonError(401, "unauthorized");

    const contentType = request.headers.get("content-type") ?? "";
    let key: string;
    if (contentType.startsWith("image/jpeg")) key = JPEG_KEY;
    else if (contentType.startsWith("image/png")) key = OG_KEY;
    else return jsonError(415, "expected-image-jpeg-or-png");

    const buf = await request.arrayBuffer();
    if (buf.byteLength === 0) return jsonError(400, "empty-body");
    if (buf.byteLength > MAX_BYTES) return jsonError(413, "too-large");

    await store().put(key, buf);
    return new Response(null, { status: 204 });
};

export const DELETE: APIRoute = async ({ session }) => {
    const authed = (await session?.get<boolean>("authed")) === true;
    if (!authed) return jsonError(401, "unauthorized");

    // Best-effort: delete the JPEG, the pre-rendered OG PNG, and any saved
    // settings. KV delete on a missing key is a no-op, so safe to run twice.
    await Promise.all([
        store().delete(JPEG_KEY),
        store().delete(OG_KEY),
        store().delete(SETTINGS_KEY),
    ]);
    return new Response(null, { status: 204 });
};

function jsonError(status: number, code: string): Response {
    return new Response(JSON.stringify({ error: code }), {
        status,
        headers: { "content-type": "application/json; charset=utf-8" },
    });
}
