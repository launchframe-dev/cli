// Module registry - available modules for LaunchFrame services
const MODULE_REGISTRY = {
  blog: {
    name: 'blog',
    displayName: 'Blog',
    description: 'Markdown-based blog using local .md files with YAML front-matter — no database required',
    services: ['website'],
    version: '1.0.0'
  },
  ai: {
    name: 'ai',
    displayName: 'AI',
    description: 'LLM integration via Anthropic SDK — call generateResponse() from LLMService in any backend service',
    services: ['backend'],
    version: '1.0.0'
  }
};

module.exports = { MODULE_REGISTRY };
