# Violin Aruba

Nicola Grigoriu’s live violin website, with performance videos, event enquiries and a restaurant schedule.

**Live site:** https://violinaruba.com

**Repository:** https://github.com/nbanguiano/violin-aruba

## Project

- `index.html`: page content and structure.
- `assets/site.css` and `assets/site.js`: site styling and interactions.
- `assets/images/` and `assets/video/`: self-hosted media.
- `assets/library/`: pinned AFEX design foundations; snapshot hashes are in `library-snapshot.json`.
- `api/contact.mjs`: Vercel Node function that sends enquiries through Resend.
- `tests/`: automated endpoint tests and a local preview with mocked email delivery.

Plain HTML, CSS and JavaScript, with no external runtime dependencies or build step. Production runs on Vercel using Node.js 24.

## Local preview and tests

Clone the website repository and use Node.js 22.14 or newer:

```sh
git clone https://github.com/nbanguiano/violin-aruba.git
cd violin-aruba
```

Start the local preview:

```sh
node tests/preview.mjs
```

Open http://127.0.0.1:18766. This preview mocks email delivery; it never sends real email. Include `SIMULATE_FAILURE` in the message to exercise the error state.

Run endpoint tests:

```sh
node --test tests/contact.test.mjs
```

## Email configuration

Configure these server-only environment variables in the existing Vercel project:

| Name | Purpose |
| --- | --- |
| `RESEND_API_KEY` | Resend sending API key, authorized for the verified sender domain. |
| `CONTACT_FROM_EMAIL` | Sender address, currently `website@notify.violinaruba.com`. |

The destination is fixed in server code to `nicola@violinaruba.com`. The visitor’s address becomes Reply-To. The function validates fields, limits request size, checks origin, uses a honeypot and best-effort per-instance throttling, and supplies a stable Resend idempotency key for retries. This throttle is not distributed across instances.

The form reports success only after Resend accepts the email. Failures retain the visitor’s details and offer retry, WhatsApp and email links. Provider acceptance does not confirm inbox delivery. There is no separate submissions database. Automated checks must use mocked delivery; do not send test enquiries to Nicola.

Use `.env.example` as a reference; never commit real credentials. Changes to Vercel environment variables require a new deployment.

## Deployment

The existing Vercel project is **nanguiano/violin-aruba**, framework preset **Other**, repository root directory, with no build command required. Production branch: `main`. The GitHub connection deploys updates pushed to that branch.

For a manual deployment with the Vercel CLI, link to the **existing** project, then verify it before deploying:

```sh
vercel link --project violin-aruba --scope nanguiano
vercel project inspect --non-interactive
vercel deploy --prod --scope nanguiano --yes --non-interactive
```

The custom domains are `violinaruba.com` and `www.violinaruba.com`. DNS is managed separately at GoDaddy; Vercel manages HTTPS. `.vercelignore` excludes documentation, tests, snapshot metadata and local configuration from website deployment.

The page currently retains its preview `noindex` directive. Search indexing should be enabled deliberately as a separate launch change.

## Content and media

The site uses Nicola’s supplied copy/media, owner-approved venue artwork and stock placeholders. This repository does not grant reuse rights to photographs, videos, logos or other brand assets. No open-source license is granted by making the repository public.
