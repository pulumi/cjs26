import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as pulumi from "@pulumi/pulumi";
import * as cloudflare from "@pulumi/cloudflare";
import * as random from "@pulumi/random";

// Build the app.
execSync("npm run build --workspace=app", { stdio: "inherit" });

const config = new pulumi.Config();
const accountId = config.require("accountID");
const subdomain = config.require("subdomain").replace(".workers.dev", "");
const workerName = config.get("workerName") || "cjs26";

// Read in the app assets and generated Wrangler config.
const serverDir = path.resolve(__dirname, "./app/dist/server");
const wranglerPath = path.join(serverDir, "wrangler.json");
const wrangler = JSON.parse(fs.readFileSync(wranglerPath, "utf-8"));
const clientDir = path.resolve(
    serverDir,
    wrangler.assets?.directory ?? "../client",
);

// Required by most non-trivial Astro SSR bundles.
const compatibilityFlags = Array.from(
    new Set([...(wrangler.compatibility_flags ?? []), "nodejs_compat"]),
);

// Provision a worker.
const worker = new cloudflare.Worker("worker", {
    accountId,
    name: workerName,
    observability: { enabled: true },
    subdomain: { enabled: true, previewsEnabled: true },
});

// Create a session namespace.
const sessionStore = new cloudflare.WorkersKvNamespace("kv-session", {
    accountId,
    title: `${workerName}-SESSION`,
});

// Create a photos namespace.
const photoStore = new cloudflare.WorkersKvNamespace("kv-photo-store", {
    accountId,
    title: `${workerName}-PHOTO_STORE`,
});

// Generate a passkey to give creators a way to sign into their apps.
const password = new random.RandomPassword("passkey", {
    length: 16,
    special: false,
});

// Define worker bindings.
const bindings: cloudflare.types.input.WorkerVersionBinding[] = [
    { type: "kv_namespace", name: "SESSION", namespaceId: sessionStore.id },
    { type: "kv_namespace", name: "PHOTO_STORE", namespaceId: photoStore.id },
    { type: "secret_text", name: "PASSKEY", text: password.result },
    { type: "images", name: "IMAGES" },
    { type: "assets", name: "ASSETS" },
];

// Create a worker version.
const version = new cloudflare.WorkerVersion("version", {
    accountId,
    workerId: worker.id,
    mainModule: wrangler.main,
    compatibilityDate: wrangler.compatibility_date,
    compatibilityFlags,
    modules: fs.globSync("**/*.mjs", { cwd: serverDir }).map((mpath) => ({
        name: mpath.split(path.sep).join("/"),
        contentFile: path.join(serverDir, mpath),
        contentType: "application/javascript+module",
    })),
    bindings,
    assets: {
        directory: clientDir,
        config: {
            htmlHandling: "auto-trailing-slash",
            notFoundHandling: "none",
        },
    },
});

// Create a deployment.
new cloudflare.WorkersDeployment("deployment", {
    accountId,
    scriptName: worker.name,
    strategy: "percentage",
    versions: [{ percentage: 100, versionId: version.id }],
});

// Export the stable production URL.
export const url = `https://${workerName}.${subdomain}.workers.dev`;

// Export the generated passkey.
export const passkey = password.result;
