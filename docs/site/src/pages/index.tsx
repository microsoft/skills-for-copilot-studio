import React from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';

import styles from './index.module.css';

// -- SVG icon helper ----------------------------------------------------------
const Ico = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

// -- Feature data -------------------------------------------------------------
const features: { icon: string; title: string; desc: string; to: string }[] = [
  {
    icon: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z',
    title: 'Author YAML',
    desc: 'Create topics, actions, knowledge sources, and triggers with schema-validated templates.',
    to: '/docs/agents/author',
  },
  {
    icon: 'M9 3h6M8 3v6l-4 11h16L16 9V3',
    title: 'Test Agents',
    desc: 'Send point-tests, run batch suites with the Copilot Studio Kit, and analyze evaluations.',
    to: '/docs/agents/test',
  },
  {
    icon: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94Z',
    title: 'Troubleshoot',
    desc: 'Diagnose wrong topic routing, validation errors, and unexpected agent behavior.',
    to: '/docs/agents/troubleshoot',
  },
  {
    icon: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    title: 'Schema Validation',
    desc: 'Validate against the official authoring schema. Look up kinds, definitions, and node types.',
    to: '/docs/reference/schema',
  },
  {
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    title: 'Known Issues',
    desc: 'Search a curated issues database before debugging. Get instant workarounds.',
    to: '/docs/troubleshooting',
  },
  {
    icon: 'M4 17l6-6-6-6M12 19h8',
    title: 'Terminal-Native',
    desc: 'Works with Claude Code and GitHub Copilot CLI. No browser, no context-switching.',
    to: '/docs/getting-started',
  },
];

// -- Workflow steps ------------------------------------------------------------
const steps: { num: string; label: string; cmd: string; desc: string }[] = [
  { num: '01', label: 'Author',       cmd: '/copilot-studio:author',       desc: 'Create topics, actions, knowledge, and adaptive cards with validated YAML.' },
  { num: '02', label: 'Test',         cmd: '/copilot-studio:test',         desc: 'Send utterances, run batch suites, and analyze evaluation results.' },
  { num: '03', label: 'Troubleshoot', cmd: '/copilot-studio:troubleshoot', desc: 'Diagnose routing issues, fix validation errors, search known issues.' },
];

// -- Stats --------------------------------------------------------------------
const stats: { value: string; label: string }[] = [
  { value: '19',  label: 'Purpose-built skills' },
  { value: '3',   label: 'Specialized agents' },
  { value: '11',  label: 'YAML templates' },
];

// =============================================================================
export default function Home(): ReactNode {
  const { siteConfig } = useDocusaurusContext();
  return (
    <Layout title={siteConfig.title} description={siteConfig.tagline}>

      {/* ================================================================== */}
      {/* HERO                                                               */}
      {/* ================================================================== */}
      <header className={styles.hero}>
        <div className={styles.heroGlow} />
        <div className={styles.heroGrid} />
        <div className={clsx('container', styles.heroInner)}>
          <p className={styles.heroBadge}>Open-source plugin for Copilot Studio</p>
          <h1 className={styles.heroTitle}>
            <span className={styles.gradient}>Skills</span> for{' '}
            <span className={styles.gradient2}>Copilot Studio</span>
          </h1>
          <p className={styles.heroSub}>
            A plugin for Claude Code and GitHub Copilot CLI that enables authoring,
            testing, and troubleshooting Microsoft Copilot Studio agents through
            YAML files — directly from your terminal.
          </p>
          <div className={styles.heroCtas}>
            <Link className={styles.btnPrimary} to="/docs/getting-started">
              Get Started
            </Link>
            <Link className={styles.btnGhost}
              href="https://github.com/microsoft/skills-for-copilot-studio">
              View on GitHub
            </Link>
          </div>

          {/* Terminal mockup */}
          <div className={styles.terminal}>
            <div className={styles.termBar}>
              <span className={styles.termDot} />
              <span className={styles.termDot} />
              <span className={styles.termDot} />
              <span className={styles.termTitle}>Terminal</span>
            </div>
            <pre className={styles.termBody}>{
`$ /copilot-studio:author Create a topic that handles
  IT service requests with an adaptive card response

  Searching schema definitions...
  Generating topic YAML...
  Validating against authoring schema...
  Writing src/topics/ITServiceRequest.topic.yaml

  Topic created and validated successfully.`
            }</pre>
          </div>
        </div>
      </header>

      {/* ================================================================== */}
      {/* STATS STRIP                                                        */}
      {/* ================================================================== */}
      <section className={styles.statsStrip}>
        <div className={clsx('container', styles.statsInner)}>
          {stats.map((s, i) => (
            <div key={i} className={styles.stat}>
              <span className={styles.statValue}>{s.value}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ================================================================== */}
      {/* FEATURES                                                           */}
      {/* ================================================================== */}
      <section className={styles.features}>
        <div className="container">
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Capabilities</p>
            <h2 className={styles.sectionTitle}>
              Everything you need for the<br />
              <span className={styles.gradient}>full agent lifecycle</span>
            </h2>
            <p className={styles.sectionSub}>
              Three specialized agents backed by 19 purpose-built skills,
              11 YAML templates, and a curated known-issues database.
            </p>
          </div>
          <div className={styles.featureGrid}>
            {features.map((f, i) => (
              <Link key={i} className={styles.featureCard} to={f.to}>
                <span className={styles.featureIcon}>
                  <Ico d={f.icon} />
                </span>
                <strong className={styles.featureTitle}>{f.title}</strong>
                <p className={styles.featureDesc}>{f.desc}</p>
                <span className={styles.featureArrow}>&#8594;</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* QUICK START                                                        */}
      {/* ================================================================== */}
      <section className={styles.quickstart}>
        <div className="container">
          <div className={styles.sectionHead}>
            <p className={styles.eyebrow}>Quick Start</p>
            <h2 className={styles.sectionTitle}>
              Up and running in{' '}
              <span className={styles.gradient}>minutes</span>
            </h2>
          </div>
          <div className={styles.qsGrid}>
            <div className={styles.qsStep}>
              <div className={styles.qsNum}>1</div>
              <div>
                <strong>Install the plugin</strong>
                <code className={styles.qsCode}>/plugin install copilot-studio@microsoft/skills-for-copilot-studio</code>
              </div>
            </div>
            <div className={styles.qsStep}>
              <div className={styles.qsNum}>2</div>
              <div>
                <strong>Clone your agent</strong>
                <code className={styles.qsCode}>Use the VS Code Copilot Studio Extension to clone your agent locally</code>
              </div>
            </div>
            <div className={styles.qsStep}>
              <div className={styles.qsNum}>3</div>
              <div>
                <strong>Author topics</strong>
                <code className={styles.qsCode}>/copilot-studio:author Create a topic that handles password resets</code>
              </div>
            </div>
            <div className={styles.qsStep}>
              <div className={styles.qsNum}>4</div>
              <div>
                <strong>Push, publish, and test</strong>
                <code className={styles.qsCode}>/copilot-studio:test Send "I forgot my password" to the published agent</code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* CTA                                                                */}
      {/* ================================================================== */}
      <section className={styles.cta}>
        <div className={styles.ctaGlow} />
        <div className={clsx('container', styles.ctaInner)}>
          <h2 className={styles.ctaTitle}>
            Start building agents{' '}
            <span className={styles.gradient}>today</span>
          </h2>
          <p className={styles.ctaSub}>
            Install the plugin, clone your Copilot Studio agent, and start
            authoring YAML topics in minutes. No context-switching required.
          </p>
          <div className={styles.heroCtas}>
            <Link className={styles.btnPrimary} to="/docs/getting-started">
              Read the Docs
            </Link>
            <Link className={styles.btnGhost} to="/docs/setup-guide">
              Setup Guide
            </Link>
          </div>
        </div>
      </section>

    </Layout>
  );
}
