// Module registry - available modules for LaunchFrame services
const MODULE_REGISTRY = {
  blog: {
    name: 'blog',
    displayName: 'Blog',
    description: 'Markdown-based blog with MongoDB storage',
    services: ['website', 'infrastructure'],
    version: '1.0.0'
  }
};

module.exports = { MODULE_REGISTRY };
