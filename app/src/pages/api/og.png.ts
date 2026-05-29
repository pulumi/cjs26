import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

// SSR endpoint: GET /api/og.png → 200 image/png (the pre-rendered ASCII
// thumbnail for og:image), or 404 if no photo has been saved yet.
// The client renders this PNG at save time and POSTs it to /api/photo with
// content-type: image/png; this endpoint just streams the latest one back.
export const prerender = false;

interface KVNamespace {
    get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
}

const OG_KEY = "current.og";

export const GET: APIRoute = async () => {
    const store = (env as { PHOTO_STORE: KVNamespace }).PHOTO_STORE;
    const data = await store.get(OG_KEY, "arrayBuffer");
    if (!data) return new Response(null, { status: 404 });
    return new Response(data, {
        status: 200,
        headers: {
            "content-type": "image/png",
            // Crawlers (Slack, Twitter, etc.) will cache the OG image themselves.
            // 60s here keeps a freshly-saved photo from being stuck behind a long
            // edge cache for users sharing the link right after capture.
            "cache-control": "public, max-age=60",
        },
    });
};
