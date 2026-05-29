# Cascadia JS 2026

A [Pulumi](https://pulumi.com) template that deploys an [Astro](astro.build) app to [Cloudflare Workers](https://www.cloudflare.com/products/workers/).

## How to use this template

1. First, get a free [Cloudflare account](https://dash.cloudflare.com/sign-up).
2. Set up your Cloudflare `workers.dev` subdomain at **Compute** → **Workers & Pages** (under Account Details)
3. Create a Cloudflare API token at **Manage Account** → **Account API tokens**. The token needs only the following two permissions:
    - Workers Scripts: Edit
    - Workers KV Storage: Edit

    Copy your account ID and the generated token for use in a moment.

4. [Install Pulumi](https://www.pulumi.com/docs/install/)

    ```bash
    brew install pulumi/tap/pulumi
    ```

    ```bash
    curl -fsSL https://get.pulumi.com | sh
    ```

**4. Create your project.**

```bash
mkdir cjs26 && cd cjs26
pulumi new https://github.com/pulumi/cjs26
```

Answer the prompts (project name, stack name). The template installs
dependencies and sets up the stack.

**5. Configure your token.** Either:

```bash
export CLOUDFLARE_API_TOKEN=<your-token>
```

…or persist it in the stack:

```bash
pulumi config set --secret cloudflare:apiToken <your-token>
```

**6. Deploy.**

```bash
pulumi up
```

Pulumi builds the Astro app, provisions the Worker and its KV namespaces,
generates a random passkey, and routes 100% of traffic to the new version.
When it finishes:

```bash
pulumi stack output url                        # the deployed URL
pulumi stack output passkey --show-secrets     # the UI's sign-in passkey
```

Open the URL, paste the passkey, click **Apply**, and start capturing.

---

## What's in here

- **`app/`** — the Astro project. UI in `src/pages/index.astro`, SSR
  endpoints under `src/pages/api/`, ASCII conversion in `src/lib/ascii.ts`
  (adapted from [mwpryer/ascii-ify](https://github.com/mwpryer/ascii-ify)).
- **`index.ts`** — the Pulumi program. Where the infrastructure is declared.
- **`util.ts`** — pre-flight Cloudflare API checks (account-ID lookup and
  subdomain verification).
- **`app/wrangler.toml`** — local-only config so `npm run dev` simulates
  Cloudflare bindings through Miniflare.

### Resources Pulumi creates

| Resource                           | What it's for                                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `random.RandomPassword`            | The 16-char passkey. Bound to the Worker as `env.PASSKEY` and exported as a secret stack output.                                       |
| `cloudflare.Worker`                | The named Worker plus its `*.workers.dev` subdomain.                                                                                   |
| `cloudflare.WorkersKvNamespace` ×2 | `SESSION` (Astro's session cookies) and `PHOTO_STORE` (latest captured JPEG, the pre-rendered OG PNG, and the saved display settings). |
| `cloudflare.WorkerVersion`         | The immutable code+bindings snapshot. Uploads `app/dist/server` as ES modules and `app/dist/client` as static assets.                  |
| `cloudflare.WorkersDeployment`     | Routes 100% of traffic to the new version.                                                                                             |

### How a request flows

A request for a static asset (`/`, `/favicon.svg`) is served directly from
Cloudflare's CDN — the Worker isn't invoked. An API request
(`POST /api/photo`) invokes the deployed Worker; Astro's SSR routes to the
matching file under `app/src/pages/api/`, the code accesses `env.PHOTO_STORE`
to read or write KV, and Cloudflare returns the response. No connection
strings or SDK setup — the bindings declared in `index.ts` are how the app
knows about the namespaces.

### Local development

```bash
npm run dev
```

Runs `astro dev` with the Cloudflare runtime emulated via Miniflare. KV
bindings work locally; the dev passkey is `dev` (set in `app/wrangler.toml`).

### Things to notice about Pulumi

- **Resources as code.** Every Cloudflare thing is a typed object. Hover any
  resource constructor in `index.ts` to see what it accepts.
- **Outputs.** `url` and `passkey` exported from `index.ts` flow straight
  into `pulumi stack output`.
- **Secrets.** The passkey is wrapped in `pulumi.secret()` so it doesn't
  appear in stack output by default and is encrypted at rest in state.
- **Cross-provider composition.** Random + Cloudflare in the same program,
  wired together at the resource level: `password.result` becomes the value
  of a Cloudflare `secret_text` binding without anything in between.
