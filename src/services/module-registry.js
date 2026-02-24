// Module registry - available modules for LaunchFrame services
const MODULE_REGISTRY = {
  blog: {
    name: 'blog',
    displayName: 'Blog',
    description: 'Markdown-based blog using local .md files with YAML front-matter — no database required',
    services: ['website'],
    version: '1.0.0'
  }
};

module.exports = { MODULE_REGISTRY };
