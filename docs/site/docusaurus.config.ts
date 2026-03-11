import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Skills for Copilot Studio',
  tagline: 'Author, test, and troubleshoot Copilot Studio agents from your terminal',
  favicon: 'img/favicon.ico',

  url: 'https://microsoft.github.io',
  baseUrl: '/skills-for-copilot-studio/',

  organizationName: 'microsoft',
  projectName: 'skills-for-copilot-studio',

  onBrokenLinks: 'warn',

  markdown: {
    format: 'md',
    hooks: {
      onBrokenMarkdownLinks: 'warn',
    },
  },

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../src',
          routeBasePath: 'docs',
          sidebarPath: './sidebars.ts',
          editUrl:
            'https://github.com/microsoft/skills-for-copilot-studio/tree/main/docs/src/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: true,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Skills for Copilot Studio',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/agents/author',
          label: 'Agents',
          position: 'left',
        },
        {
          to: '/docs/skills/overview',
          label: 'Skills',
          position: 'left',
        },
        {
          href: 'https://github.com/microsoft/skills-for-copilot-studio',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Get Started',
          items: [
            { label: 'Installation', to: '/docs/getting-started' },
            { label: 'Setup Guide', to: '/docs/setup-guide' },
            { label: 'Troubleshooting', to: '/docs/troubleshooting' },
          ],
        },
        {
          title: 'Agents',
          items: [
            { label: 'Author', to: '/docs/agents/author' },
            { label: 'Test', to: '/docs/agents/test' },
            { label: 'Troubleshoot', to: '/docs/agents/troubleshoot' },
          ],
        },
        {
          title: 'Skills',
          items: [
            { label: 'All Skills', to: '/docs/skills/overview' },
            { label: 'Authoring', to: '/docs/skills/authoring' },
            { label: 'Testing', to: '/docs/skills/testing' },
            { label: 'Utilities', to: '/docs/skills/utilities' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/microsoft/skills-for-copilot-studio' },
            { label: 'Issues', href: 'https://github.com/microsoft/skills-for-copilot-studio/issues' },
            { label: 'Contributing', href: 'https://github.com/microsoft/skills-for-copilot-studio/blob/main/CONTRIBUTING.md' },
            { label: 'Copilot Studio', href: 'https://aka.ms/CopilotStudio' },
          ],
        },
      ],
      copyright: `Copyright &copy; ${new Date().getFullYear()} Microsoft Corporation. MIT License.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'powershell', 'json', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
