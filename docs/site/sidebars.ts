import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started',
        'setup-guide',
      ],
    },
    {
      type: 'category',
      label: 'Agents',
      collapsed: false,
      items: [
        'agents/author',
        'agents/test',
        'agents/troubleshoot',
      ],
    },
    {
      type: 'category',
      label: 'Skills',
      items: [
        'skills/overview',
        'skills/authoring',
        'skills/testing',
        'skills/utilities',
      ],
    },
    {
      type: 'category',
      label: 'Templates',
      items: [
        'templates/overview',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      items: [
        'reference/project-structure',
        'reference/schema',
      ],
    },
    'troubleshooting',
  ],
};

export default sidebars;
