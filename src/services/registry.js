// Service registry - available optional services for LaunchFrame
const SERVICE_REGISTRY = {
  waitlist: {
    name: 'waitlist',
    displayName: 'Waitlist Landing Page',
    description: 'Coming soon page with email collection via Airtable',
    repoUrl: 'https://github.com/{{GITHUB_ORG}}/launchframe-waitlist',
    techStack: 'Next.js (standalone)',
    dependencies: ['Airtable API'],
    standalone: true, // Has own docker-compose files, not part of infrastructure/
    envVars: {
      AIRTABLE_PERSONAL_ACCESS_TOKEN: 'Your Airtable personal access token (create at https://airtable.com/create/tokens)',
      AIRTABLE_BASE_ID: 'Your Airtable base ID (e.g., appHhPeD0hVeiE7dS - found in your base URL: airtable.com/appXXXXXX/...)',
      AIRTABLE_TABLE_NAME: 'Your Airtable table name (e.g., "Waitlist Signups" - the exact name of your table, not the table ID)',
      NEXT_PUBLIC_MIXPANEL_PROJECT_TOKEN: '[OPTIONAL] Your Mixpanel project token (find at mixpanel.com/project/[project-id]/settings - leave blank to disable analytics)',
      NEXT_PUBLIC_MIXPANEL_DATA_RESIDENCY: '[OPTIONAL] Mixpanel data residency (US or EU - leave blank for US default)'
    },
    installPath: 'waitlist',
    devPort: 3002,
    version: '1.0.0'
  },
  docs: {
    name: 'docs',
    displayName: 'Documentation Site',
    description: 'VitePress documentation site with LaunchFrame philosophy',
    repoUrl: 'https://github.com/{{GITHUB_ORG}}/launchframe-docs',
    techStack: 'VitePress + sirv-cli',
    dependencies: ['None'],
    standalone: false, // Integrated into main infrastructure/
    envVars: {}, // No env vars needed for static docs
    installPath: 'docs',
    devPort: 5173,
    version: '1.0.0'
  },
  'customers-portal': {
    name: 'customers-portal',
    displayName: 'Customers Portal',
    description: 'Customer-facing portal for B2B2C (React + Vite + Zustand)',
    repoUrl: 'https://github.com/{{GITHUB_ORG}}/launchframe-customers-portal',
    techStack: 'React + Vite + Zustand + TanStack Query',
    dependencies: ['backend'],
    standalone: false, // Integrated into main infrastructure/
    envVars: {}, // Uses standard env vars from infrastructure/.env
    installPath: 'customers-portal',
    devPort: 3000,
    version: '1.0.0'
  }
};

module.exports = { SERVICE_REGISTRY };
