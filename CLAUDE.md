# LaunchFrame CLI

CLI tool for generating new projects from the LaunchFrame template.

## Purpose

The CLI takes user input (project name, domain, GitHub org, etc.) and:
1. Copies the `services/` template
2. Replaces all `{{TEMPLATE_VARIABLES}}`
3. Generates secrets (DB password, auth secret)
4. Sets up the project structure

## Template Variables

The CLI replaces these placeholders in all files:
- `{{PROJECT_NAME}}` - lowercase project name
- `{{PROJECT_NAME_UPPER}}` - uppercase project name
- `{{GITHUB_ORG}}` - GitHub organization/username
- `{{PRIMARY_DOMAIN}}` - main domain (e.g., mysaas.com)
- `{{ADMIN_EMAIL}}` - admin email for Let's Encrypt
- `{{VPS_HOST}}` - VPS hostname/IP
- `{{BETTER_AUTH_SECRET}}` - auto-generated (32+ chars)
- `{{DB_PASSWORD}}` - auto-generated

## Development

TODO: CLI implementation details
