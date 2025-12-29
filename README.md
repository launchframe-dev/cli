# LaunchFrame CLI

> Ship your B2B SaaS to production in hours, not weeks.

LaunchFrame is a production-ready SaaS boilerplate that deploys to a single affordable VPS. Get subscriptions, credits, multi-tenancy, feature gating, and API management out of the box.

![LaunchFrame CLI Preview](https://unpkg.com/@launchframe/cli@latest/cli.png)

## What You Get

- **Single VPS deployment**: Everything runs on one $7-20/mo server (Docker + Traefik)
- **Variant selection on init**: Choose single/multi-tenant, B2B/B2B2C - optimized for your use case
- **Service registry**: Add new services (docs, waitlist, admin tools) with zero config
- **Full-stack TypeScript**: NestJS backend, React frontends, Next.js marketing site
- **Monetization built-in**: Subscriptions (Polar.sh MOR) + usage-based credits
- **Flexible tenancy models**: Single-tenant (simpler) or multi-tenant (workspaces + custom domains)
- **B2B + B2B2C support**: Admin-only or admin+end-user models
- **Feature guard system**: Tier-based access control across frontend and backend
- **Production-grade auth**: JWT + OAuth (Google), role-based access control
- **API-first**: Auto-generated OpenAPI docs, API key management
- **Resilient architecture**: Background jobs, webhook processing, health checks

## Installation

```bash
npm install -g @launchframe/cli
```

## Quick Start

Initialize a new LaunchFrame project:

```bash
launchframe init
```

### Local Development

Start the full stack locally with Docker:

```bash
launchframe docker:up
```

This spins up all services (backend, admin portal, customer portal, website, database, etc.) with hot-reload enabled. Build your domain logic, customize the UI, and test everything locally.

### Deployment

When you're ready to deploy to your VPS:

```bash
launchframe deploy:configure  # Set up deployment configuration
launchframe deploy:set-env    # Configure environment variables
launchframe deploy:init       # Initialize the VPS
launchframe deploy:up         # Deploy to production
```

**[Get started at launchframe.dev](https://launchframe.dev)** | **[Read the docs at docs.launchframe.dev](https://docs.launchframe.dev)**

## Why LaunchFrame?

Most SaaS boilerplates give you authentication and a database. LaunchFrame gives you a **complete business**:

- Subscriptions AND credits (hybrid monetization)
- Feature flags tied to billing tiers
- Multi-tenant architecture with project isolation
- Webhook processing that actually scales
- API key system with usage tracking
- Zero-downtime deployment patterns
- Comprehensive documentation

All tested in production. All ready to customize.

## Documentation

Full documentation is available at **[docs.launchframe.dev](https://docs.launchframe.dev)**, including:

- Getting started guides
- Architecture overview
- Deployment instructions
- API reference
- Feature customization guides
- Multi-tenancy patterns

## License

MIT

---

Built with ⚡ by developers who were tired of rebuilding the same SaaS infrastructure over and over.
