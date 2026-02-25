// Module configuration - defines files, sections, and dependencies for each module
const MODULE_CONFIG = {
  blog: {
    website: {
      files: [
        'src/lib/blog.ts',
        'src/types/blog.ts',
        'src/app/blog',
        'src/components/blog',
        'src/app/sitemap.ts',
        'content/blog',
      ],
      sections: {
        'src/components/layout/Navbar.tsx': ['BLOG_NAV_LINK'],
        'src/components/layout/Footer.tsx': ['BLOG_FOOTER_LINK'],
      },
      dependencies: {
        'gray-matter': '^4.0.3',
        'marked': '^12.0.0',
      },
    },
  },
};

module.exports = { MODULE_CONFIG };
