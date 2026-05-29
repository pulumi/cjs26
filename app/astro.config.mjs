// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";

// https://astro.build/config
export default defineConfig({
    // Pages are prerendered to dist/client by default. Any page (or endpoint)
    // that exports `prerender = false` runs on the Worker per request — that's
    // how "hybrid" works in current Astro.
    output: "static",

    adapter: cloudflare({
        // Run the Cloudflare runtime locally during `astro dev`, so bindings
        // (SESSION KV, IMAGES, ASSETS) resolve the way they will in production.
        platformProxy: { enabled: true },
    }),
});
