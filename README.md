# CascadiaJS 2026

A [Pulumi](https://pulumi.com) [template](https://www.pulumi.com/blog/how-to-create-and-share-a-pulumi-template/) that deploys an [Astro](https://astro.build) app to [Cloudflare Workers](https://www.cloudflare.com/products/workers/).

## Using this template

1. First, get a free [Cloudflare account](https://dash.cloudflare.com/sign-up) if you don't already have one, then head to the [Cloudflare Dashboard](https://dash.cloudflare.com).
1. Set up your Cloudflare `workers.dev` subdomain at **Compute** → **Workers & Pages** (under Account Details) and take note of the subdomain.
1. Create a Cloudflare API token at **Manage Account** → **Account API tokens**. The token only needs these two permissions:
    - Workers Scripts: Edit
    - Workers KV Storage: Edit

    Copy your Cloudflare account ID and the generated token for use below.

1. Install Pulumi:

    ```bash
    brew install pulumi/tap/pulumi
    ```

    or

    ```bash
    curl -fsSL https://get.pulumi.com | sh
    ```

    [See the docs](https://www.pulumi.com/docs/install) for additional options.

1. Create a new project with the template:

    ```bash
    mkdir cjs26 && cd cjs26
    pulumi new https://github.com/pulumi/cjs26
    ```

    Step through the wizard, pasting your Cloudflare account ID and subdomain when prompted.

1. Configure your Cloudflare token for use with Pulumi, either by exporting an environment variable into your shell:

    ```bash
    export CLOUDFLARE_API_TOKEN=<your-token>
    ```

    ... or setting it as an encrypted Pulumi secret:

    ```bash
    pulumi config set cloudflare:apiToken <your-token> --secret
    ```

1. Deploy! 🚀

    ```bash
    pulumi up
    ```

    ```
    Updating (dev)

        Type                                    Name            Status              Info
    +   pulumi:pulumi:Stack                     cjs26-dev       created (17s)       24 messages
    +   ├─ cloudflare:index:WorkersKvNamespace  kv-photo-store  created (1s)
    +   ├─ cloudflare:index:Worker              worker          created (0.80s)
    +   ├─ random:index:RandomPassword          passkey         created (0.31s)
    +   ├─ cloudflare:index:WorkersKvNamespace  kv-session      created (1s)
    +   ├─ cloudflare:index:WorkerVersion       version         created (8s)
    +   └─ cloudflare:index:WorkersDeployment   deployment      created (0.67s)

    Outputs:
        passkey: [secret]
        url    : "https://cjs26.<your-domain>.workers.dev"

    Resources:
        + 7 created
    ```

When the deployment completes, follow the link to your deployed site. There, Click Edit, and you'll be asked for your stack's computed passkey. You can get as a Pulumi [stack output](https://www.pulumi.com/docs/iac/concepts/inputs-outputs/):

```bash
pulumi stack output passkey --show-secrets
```

Click Log In, and off you go. (Click Log Out in the header to end your session.)

## What's under the hood

The template deploys an Astro app that opens a connection to a local webcam, captures an image, and saves it as ASCII. The repo contents are as follows:

- `app/`: The Astro project — front-end in `src/pages`, API endpoints in `src/pages/api/`, and ASCII conversion tooling (courtesy of [mwpryer/ascii-ify](https://github.com/mwpryer/ascii-ify)) in `src/lib/ascii.ts`.
- `index.ts`: The Pulumi TypeScript program. Where the infrastructure is declared.
- `Pulumi.yaml` and `Pulumi.<stack>.yaml`: The Pulumi [project](https://www.pulumi.com/docs/iac/concepts/projects/) and [stack](https://www.pulumi.com/docs/iac/concepts/stacks/) configuration files.

### What Pulumi creates

Pulumi uses the [`@pulumi/cloudflare`](https://www.pulumi.com/registry/packages/cloudflare/) and [`@pulumi/random`](https://www.pulumi.com/registry/packages/random/) providers to provision the following resources:

| Resource                           | What it's for                                                                                                                                |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `cloudflare.Worker`                | The named Cloudflare Worker and its `*.workers.dev` subdomain.                                                                               |
| `cloudflare.WorkersKvNamespace` ×2 | `SESSION`, for Astro's session cookies, and `PHOTO_STORE`, for the latest captured JPEG, PNG, and saved display settings.                    |
| `cloudflare.WorkerVersion`         | The immutable code/bindings snapshot. Uploads `app/dist/server` as ES modules and `app/dist/client` as static assets.                        |
| `cloudflare.WorkersDeployment`     | Routes 100% of traffic to the new worker version.                                                                                            |
| `random.RandomPassword`            | A 16-character passkey managed as a [Pulumi secret](https://www.pulumi.com/docs/iac/concepts/secrets/). Bound to the Worker as `env.PASSKEY` |

### How a request flows

Requests for static assets are served directly from Cloudflare's CDN. API requests (e.g., `POST /api/photo`) invoke the deployed Worker. Astro's SSR routes to the matching file under `app/src/pages/api/`, the code accesses `env.PHOTO_STORE` to read or write KV, and Cloudflare returns the response. The bindings declared in `index.ts` are how the app knows about the namespaces.

### Local development

```bash
npm install
npm run dev
```

Runs `astro dev` with the Cloudflare runtime emulated via Miniflare. KV bindings work locally; the passkey in development is simply `dev`. (It's set in `app/wrangler.toml`.)

## A few notes about Pulumi

- **Resources as code**: Every Cloudflare resource is a typed Pulumi object. Hover over any resource constructor in `index.ts` to see what it accepts and how to work with it.
- **Stack outputs**: Computed values like `url` and `passkey` are exported from `index.ts` and available through the CLI with `pulumi stack output`.
- **Secrets**: The passkey is managed internally as a Pulumi secret, so it's suppressed in stack output and fully encrypted at rest in state.
- **Multiple providers, integration with the app**: The Random and Cloudflare providers are used in the same program, wired together at the resource level with `password.result` passed into the Cloudflare `secret_text` binding for use in the app.

To learn more about Pulumi, visit [pulumi.com](https://pulumi.com) and in particular [pulumi.com/cjs26](https://pulumi.com/cjs26). 🛸

Enjoy the conference! 🌲💜👋
