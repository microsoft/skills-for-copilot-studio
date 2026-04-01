#!/usr/bin/env python3
"""Generate a self-contained HTML report from skill eval results.

Reads one or more <skill>.json result files from a results directory
and produces a single HTML file with:
- Summary dashboard (pass rates, charts)
- Per-skill breakdown with expandable eval details
- Check-level results with evidence
- Links to generated artifact files

Usage:
    python evals/report.py evals/results/20260401-143000/
    python evals/report.py evals/results/20260401-143000/ --output report.html
"""

import argparse
import html
import json
import re
import sys
from datetime import datetime
from pathlib import Path


def load_results(results_dir: Path) -> list[dict]:
    """Load all <skill>.json files from a results directory."""
    results = []
    for f in sorted(results_dir.glob("*.json")):
        try:
            data = json.loads(f.read_text())
            if "skill_name" in data and "results" in data:
                results.append(data)
        except (json.JSONDecodeError, KeyError):
            continue
    return results


def sanitize_id(name: str) -> str:
    """Sanitize a string for use as an HTML id attribute."""
    return re.sub(r'[^a-zA-Z0-9_-]', '-', name)


def generate_html(results: list[dict], results_dir: Path) -> str:
    """Generate self-contained HTML report."""
    # Compute totals
    total_skills = len(results)
    total_evals = sum(r["summary"]["total_evals"] for r in results)
    total_checks = sum(r["summary"]["total_checks"] for r in results)
    total_passed = sum(r["summary"]["total_checks_passed"] for r in results)
    total_failed = sum(r["summary"]["total_checks_failed"] for r in results)
    pass_rate = (total_passed / total_checks * 100) if total_checks > 0 else 0

    evals_passed = 0
    evals_failed = 0
    for r in results:
        for ev in r["results"]:
            if ev["summary"]["failed"] == 0:
                evals_passed += 1
            else:
                evals_failed += 1

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cli = results[0]["cli"] if results else "unknown"

    # Build skill cards
    skill_cards = []
    for skill_data in results:
        skill_name = skill_data["skill_name"]
        skill_cards.append(build_skill_card(skill_name, skill_data, results_dir))

    # Build skill nav items for sidebar
    skill_nav_items = []
    for skill_data in results:
        sn = skill_data["skill_name"]
        sf = skill_data["summary"]["total_checks_failed"]
        nav_class = "nav-fail" if sf > 0 else "nav-pass"
        skill_nav_items.append(
            f'<a href="#skill-{sanitize_id(sn)}" class="nav-item {nav_class}" data-skill="{sanitize_id(sn)}">{html.escape(sn)}</a>'
        )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Skill Eval Report — {timestamp}</title>
<style>
{CSS}
</style>
</head>
<body>
<div class="layout">
  <nav class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <a href="https://github.com/microsoft/skills-for-copilot-studio" class="logo-link" target="_blank" rel="noopener">
        <svg class="logo-icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
        Skills for Copilot Studio
      </a>
    </div>
    <div class="sidebar-meta">
      <span class="meta-item">{timestamp}</span>
      <span class="meta-item">CLI: {html.escape(cli)}</span>
    </div>
    <div class="sidebar-section-label">Skills</div>
    <div class="nav-list">
      {''.join(skill_nav_items)}
    </div>
    <div class="sidebar-actions">
      <button class="action-btn" onclick="expandAll()">Expand all</button>
      <button class="action-btn" onclick="collapseAll()">Collapse all</button>
    </div>
  </nav>

  <main class="main-content">
    <div class="topbar">
      <div class="topbar-left">
        <button class="sidebar-toggle" onclick="toggleSidebar()" title="Toggle sidebar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <div class="filters">
          <button class="filter-btn active" data-filter="all">All</button>
          <button class="filter-btn" data-filter="passed">Passed</button>
          <button class="filter-btn" data-filter="failed">Failed</button>
        </div>
      </div>
      <div class="topbar-right">
        <span class="kbd-hint" title="Keyboard: j/k navigate, Enter expand, Esc collapse">
          <kbd>j</kbd><kbd>k</kbd> navigate
        </span>
      </div>
    </div>

    <div class="dashboard">
      <div class="stat-card">
        <div class="stat-value">{total_skills}</div>
        <div class="stat-label">Skills</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{total_evals}</div>
        <div class="stat-label">Evals</div>
      </div>
      <div class="stat-card {'stat-success' if total_failed == 0 else 'stat-mixed' if total_passed > 0 else 'stat-fail'}">
        <div class="stat-value">{pass_rate:.0f}%</div>
        <div class="stat-label">Pass Rate</div>
      </div>
      <div class="stat-card stat-success">
        <div class="stat-value">{evals_passed}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card {'stat-fail' if evals_failed > 0 else 'stat-success'}">
        <div class="stat-value">{evals_failed}</div>
        <div class="stat-label">Failed</div>
      </div>
    </div>

    <div class="progress-bar">
      <div class="progress-fill" style="width: {pass_rate}%"></div>
    </div>
    <p class="progress-label">{total_passed}/{total_checks} checks passed</p>

    <div class="skills-list">
      {''.join(skill_cards)}
    </div>
  </main>
</div>

<script>
{JS}
</script>
</body>
</html>"""


def build_skill_card(skill_name: str, skill_data: dict, results_dir: Path) -> str:
    """Build HTML for a single skill card with its evals."""
    summary = skill_data["summary"]
    passed = summary["total_checks_passed"]
    total = summary["total_checks"]
    failed = summary["total_checks_failed"]
    all_passed = failed == 0
    status_class = "skill-passed" if all_passed else "skill-failed"

    eval_rows = []
    for ev in skill_data["results"]:
        eval_rows.append(build_eval_row(skill_name, ev, results_dir))

    return f"""
    <div class="skill-card {status_class}" data-status="{'passed' if all_passed else 'failed'}" id="skill-{sanitize_id(skill_name)}">
      <div class="skill-header" onclick="toggleSkill(this)">
        <div class="skill-info">
          <span class="skill-accent {'accent-pass' if all_passed else 'accent-fail'}"></span>
          <h2>{html.escape(skill_name)}</h2>
          <span class="eval-count">{len(skill_data['results'])} eval{'s' if len(skill_data['results']) != 1 else ''}</span>
        </div>
        <div class="skill-stats">
          <span class="checks-badge {'badge-pass' if all_passed else 'badge-fail'}">{passed}/{total} checks</span>
          <span class="chevron">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
        </div>
      </div>
      <div class="skill-body">
        {''.join(eval_rows)}
      </div>
    </div>"""


def build_eval_row(skill_name: str, ev: dict, results_dir: Path) -> str:
    """Build HTML for a single eval within a skill card."""
    eval_id = ev["eval_id"]
    eval_name = ev.get("name", "")
    prompt = ev["prompt"]
    s = ev["summary"]
    all_passed = s["failed"] == 0
    status_class = "eval-passed" if all_passed else "eval-failed"

    # Build artifact pills (paths relative to report.html in same results dir)
    artifact_pills = []
    for art in ev.get("artifacts", []):
        # art is like "eval-1/topics/ITSupport.topic.mcs.yml" — relative to artifacts_dir
        # artifacts_dir is <results_dir>/<skill_name>/, so link is <skill_name>/<art>
        rel_path = f"{skill_name}/{art}"
        fname = html.escape(art.split("/")[-1])
        artifact_pills.append(
            f'<a href="{html.escape(rel_path)}" class="artifact-pill" title="Open generated file">{fname}</a>'
        )
    if not artifact_pills and ev.get("changed_files"):
        for cf in ev["changed_files"]:
            artifact_pills.append(f'<span class="artifact-pill artifact-pill-inert">{html.escape(cf)}</span>')

    artifacts_html = ""
    if artifact_pills:
        artifacts_html = f'<div class="artifacts"><span class="artifacts-label">Generated</span>{" ".join(artifact_pills)}</div>'

    # Build check rows
    check_rows = []
    for check in ev.get("checks", []):
        c_passed = check["passed"]
        c_class = "check-pass" if c_passed else "check-fail"
        c_dot = f'<span class="check-dot {"dot-pass" if c_passed else "dot-fail"}"></span>'
        raw_evidence = check.get("evidence", "")
        evidence_escaped = html.escape(raw_evidence)
        short_evidence = html.escape(raw_evidence.split("\n")[0][:120])

        # Use <details> for long or multiline evidence
        is_long = len(raw_evidence) > 120 or "\n" in raw_evidence
        if is_long and raw_evidence.strip():
            evidence_html = f"""<details class="evidence-details">
              <summary class="evidence-summary">{short_evidence}{'&hellip;' if len(raw_evidence.split(chr(10))[0]) > 120 or len(raw_evidence) > 120 else ''}</summary>
              <pre class="evidence-full">{evidence_escaped}</pre>
            </details>"""
        else:
            evidence_html = f'<span class="check-evidence">{evidence_escaped}</span>'

        check_rows.append(f"""
          <div class="check-row {c_class}">
            {c_dot}
            <span class="check-name">{html.escape(check['check'])}</span>
            <span class="check-evidence-wrap">{evidence_html}</span>
          </div>""")

    # Response preview with toggle
    raw_response = ev.get("response_text", "")
    short_response = html.escape(raw_response[:200])
    full_response = html.escape(raw_response)
    is_truncated = len(raw_response) > 200

    if is_truncated:
        response_html = f"""<div class="response-box">
            <span class="response-label">Response</span>
            <details class="response-details">
              <summary class="response-summary">{short_response}&hellip;</summary>
              <div class="response-full">{full_response}</div>
            </details>
          </div>"""
    else:
        response_html = f"""<div class="response-box">
            <span class="response-label">Response</span>
            <div class="response-text">{full_response}</div>
          </div>"""

    return f"""
      <div class="eval-row {status_class}">
        <div class="eval-header" onclick="toggleEval(this)">
          <div class="eval-info">
            <span class="status-dot {'dot-pass' if all_passed else 'dot-fail'}"></span>
            <span class="eval-id">#{eval_id}</span>
            <span class="eval-name">{html.escape(eval_name) if eval_name else html.escape(prompt[:100]) + ('&hellip;' if len(prompt) > 100 else '')}</span>
          </div>
          <div class="eval-stats">
            <span class="checks-badge-sm {'badge-pass' if all_passed else 'badge-fail'}">{s['passed']}/{s['total']}</span>
            <span class="chevron-sm">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </div>
        </div>
        <div class="eval-body">
          <div class="prompt-box">
            <span class="prompt-label">Prompt</span>
            <div class="prompt-text">{html.escape(prompt)}</div>
          </div>
          {artifacts_html}
          {response_html}
          <div class="checks-list">
            {''.join(check_rows)}
          </div>
        </div>
      </div>"""


CSS = """
/* Reset & base */
*, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
  background: #0d1117; color: #c9d1d9; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
code {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.82em; background: #161b22; padding: 2px 6px; border-radius: 4px;
  color: #8b949e;
}

/* Layout: sidebar + main */
.layout { display: flex; min-height: 100vh; }

/* ── Sidebar ── */
.sidebar {
  width: 220px; flex-shrink: 0; background: #0a0d12; border-right: 1px solid #1c2028;
  position: sticky; top: 0; height: 100vh; overflow-y: auto;
  display: flex; flex-direction: column; padding: 20px 0;
  transition: margin-left 0.25s ease, opacity 0.2s ease;
}
.sidebar.collapsed { margin-left: -220px; opacity: 0; pointer-events: none; }
.sidebar-header { padding: 0 16px 16px; border-bottom: 1px solid #1c2028; }
.logo-link {
  color: #f0f3f6; text-decoration: none; font-size: 0.82rem; font-weight: 600;
  display: flex; align-items: center; gap: 8px; letter-spacing: -0.01em;
}
.logo-link:hover { color: #58a6ff; }
.logo-icon { flex-shrink: 0; opacity: 0.7; }
.sidebar-meta { padding: 12px 16px; display: flex; flex-direction: column; gap: 2px; }
.meta-item { font-size: 0.68rem; color: #484f58; }
.sidebar-section-label {
  font-size: 0.65rem; color: #484f58; text-transform: uppercase; letter-spacing: 0.08em;
  font-weight: 600; padding: 12px 16px 6px;
}
.nav-list { flex: 1; display: flex; flex-direction: column; gap: 1px; padding: 0 8px; }
.nav-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 6px;
  font-size: 0.78rem; color: #8b949e; text-decoration: none;
  transition: background 0.1s ease, color 0.1s ease;
}
.nav-item:hover { background: #161b22; color: #c9d1d9; }
.nav-item.active { background: #1c2028; color: #f0f3f6; }
.nav-item::before {
  content: ''; width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.nav-pass::before { background: #3fb950; }
.nav-fail::before { background: #f85149; }
.sidebar-actions { padding: 12px 16px; border-top: 1px solid #1c2028; display: flex; gap: 6px; }
.action-btn {
  flex: 1; background: #161b22; border: 1px solid #21262d; color: #7d8590;
  padding: 5px 8px; border-radius: 5px; cursor: pointer;
  font-size: 0.68rem; font-weight: 500; transition: all 0.15s ease;
}
.action-btn:hover { border-color: #30363d; color: #c9d1d9; }

/* ── Main content ── */
.main-content { flex: 1; min-width: 0; padding: 0 32px 64px; }

/* Topbar */
.topbar {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 0 20px; position: sticky; top: 0; z-index: 10;
  background: #0d1117; border-bottom: 1px solid #161b22; margin-bottom: 24px;
}
.topbar-left { display: flex; align-items: center; gap: 12px; }
.topbar-right { display: flex; align-items: center; gap: 8px; }
.sidebar-toggle {
  background: none; border: 1px solid #21262d; color: #7d8590; border-radius: 6px;
  padding: 5px 7px; cursor: pointer; display: flex; align-items: center;
  transition: all 0.15s ease;
}
.sidebar-toggle:hover { border-color: #30363d; color: #c9d1d9; }
.kbd-hint { font-size: 0.7rem; color: #484f58; display: flex; align-items: center; gap: 4px; }
kbd {
  display: inline-block; background: #161b22; border: 1px solid #30363d; border-radius: 3px;
  padding: 1px 5px; font-family: 'SF Mono', monospace; font-size: 0.68rem; color: #7d8590;
}

/* Filters */
.filters { display: flex; gap: 6px; }
.filter-btn {
  background: #161b22; border: 1px solid #30363d; color: #7d8590;
  padding: 5px 14px; border-radius: 6px; cursor: pointer;
  font-size: 0.78rem; font-weight: 500; transition: all 0.15s ease;
}
.filter-btn:hover { border-color: #58a6ff; color: #c9d1d9; }
.filter-btn.active { background: #1f6feb; border-color: #1f6feb; color: #fff; }

/* Dashboard */
.dashboard { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 20px; }
@media (max-width: 900px) { .dashboard { grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); } }
.stat-card {
  background: #161b22; border: 1px solid #21262d; border-radius: 8px;
  padding: 14px 10px; text-align: center;
}
.stat-value { font-size: 1.5rem; font-weight: 700; color: #f0f3f6; }
.stat-label { font-size: 0.68rem; color: #7d8590; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 2px; }
.stat-success .stat-value { color: #3fb950; }
.stat-fail .stat-value { color: #f85149; }
.stat-mixed .stat-value { color: #d29922; }

/* Progress */
.progress-bar { height: 5px; background: #21262d; border-radius: 3px; overflow: hidden; margin-bottom: 6px; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #3fb950, #2ea043); border-radius: 3px; transition: width 0.4s ease; }
.progress-label { font-size: 0.78rem; color: #484f58; margin-bottom: 28px; }

/* ── Skill cards (level 1) ── */
.skill-card {
  background: #161b22; border: 1px solid #21262d; border-radius: 10px;
  margin-bottom: 10px; overflow: hidden; scroll-margin-top: 80px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.skill-card:hover { border-color: #30363d; }
.skill-card.focused { box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.4); }
.skill-passed { border-left: 3px solid #3fb950; }
.skill-failed { border-left: 3px solid #f85149; }

.skill-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 14px 18px; cursor: pointer; user-select: none;
  transition: background 0.1s ease;
}
.skill-header:hover { background: #1c2028; }
.skill-info { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.skill-info h2 { font-size: 0.95rem; font-weight: 600; color: #f0f3f6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.eval-count { font-size: 0.72rem; color: #7d8590; background: #0d1117; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }
.skill-stats { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }

.checks-badge, .checks-badge-sm { font-size: 0.78rem; padding: 3px 10px; border-radius: 12px; font-weight: 500; white-space: nowrap; }
.badge-pass { background: rgba(63, 185, 80, 0.12); color: #3fb950; }
.badge-fail { background: rgba(248, 81, 73, 0.12); color: #f85149; }

.chevron, .chevron-sm { color: #484f58; display: flex; align-items: center; transition: transform 0.25s ease; }
.expanded .chevron, .expanded .chevron-sm { transform: rotate(180deg); }

/* Animated expand/collapse */
.skill-body {
  max-height: 0; overflow: hidden;
  transition: max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), padding 0.25s ease;
  padding: 0 18px;
}
.skill-card.open .skill-body { max-height: 5000px; padding: 0 18px 14px; }
.skill-card.open.settled .skill-body { max-height: none; }

/* ── Eval rows (level 2) ── */
.eval-row {
  background: #0d1117; border: 1px solid #1c2028; border-radius: 8px;
  margin-top: 8px; overflow: hidden;
}
.eval-row.focused { box-shadow: 0 0 0 1px rgba(88, 166, 255, 0.35); }
.eval-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; cursor: pointer; transition: background 0.1s ease;
}
.eval-header:hover { background: #161b22; }
.eval-info { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.eval-stats { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

.status-dot, .check-dot {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; display: inline-block;
}
.dot-pass { background: #3fb950; }
.dot-fail { background: #f85149; }

.eval-id { font-weight: 600; color: #c9d1d9; font-size: 0.82rem; white-space: nowrap; }
.eval-name { color: #c9d1d9; font-size: 0.82rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.eval-body {
  max-height: 0; overflow: hidden;
  transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1), padding 0.2s ease;
  padding: 0 14px; border-top: 0 solid transparent;
}
.eval-row.open .eval-body {
  max-height: 3000px; padding: 12px 14px 14px; border-top: 1px solid #1c2028;
}
.eval-row.open.settled .eval-body { max-height: none; }

/* ── Prompt ── */
.prompt-box { margin-bottom: 12px; }
.prompt-label {
  display: block; font-size: 0.68rem; color: #484f58; text-transform: uppercase;
  letter-spacing: 0.05em; font-weight: 600; margin-bottom: 4px;
}
.prompt-text {
  font-size: 0.88rem; color: #e1e4e8; line-height: 1.55;
  border-left: 2px solid #30363d; padding-left: 12px;
}

/* ── Artifacts ── */
.artifacts { margin-bottom: 12px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.artifacts-label {
  font-size: 0.68rem; color: #484f58; text-transform: uppercase; letter-spacing: 0.05em;
  font-weight: 600; margin-right: 2px;
}
.artifact-pill {
  display: inline-block;
  font-size: 0.75rem; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  color: #58a6ff; background: rgba(56, 139, 253, 0.12);
  padding: 3px 10px; border-radius: 12px;
  text-decoration: none; transition: background 0.15s ease; white-space: nowrap;
}
.artifact-pill:hover { background: rgba(56, 139, 253, 0.22); }
a.artifact-pill:hover { text-decoration: underline; }
.artifact-pill-inert { color: #8b949e; background: rgba(139, 148, 158, 0.1); cursor: default; }

/* ── Response ── */
.response-box {
  margin-bottom: 12px; padding: 12px 14px;
  background: #161b22; border: 1px solid #21262d; border-radius: 8px;
}
.response-label {
  display: block; font-size: 0.68rem; color: #484f58; text-transform: uppercase;
  letter-spacing: 0.05em; font-weight: 600; margin-bottom: 6px;
}
.response-text, .response-full {
  font-size: 0.85rem; color: #8b949e; white-space: pre-wrap; word-break: break-word; line-height: 1.55;
}
.response-details > .response-summary {
  font-size: 0.85rem; color: #8b949e; cursor: pointer; line-height: 1.55; list-style: none;
}
.response-details > .response-summary::-webkit-details-marker { display: none; }
.response-details > .response-summary::after {
  content: 'Show full response'; display: inline-block; margin-left: 6px;
  font-size: 0.72rem; color: #58a6ff; font-weight: 500;
}
.response-details[open] > .response-summary { display: none; }
.response-details[open] > .response-full { display: block; }
.response-full { display: none; }

/* ── Checks (level 3) ── */
.checks-list { display: flex; flex-direction: column; gap: 3px; }
.check-row {
  display: flex; align-items: flex-start; gap: 8px; padding: 5px 8px;
  border-radius: 5px; font-size: 0.78rem;
}
.check-pass { background: rgba(63, 185, 80, 0.04); }
.check-fail { background: rgba(248, 81, 73, 0.06); }
.check-dot { margin-top: 5px; width: 7px; height: 7px; }
.check-name {
  color: #c9d1d9; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.76rem; white-space: nowrap; flex-shrink: 0;
}
.check-evidence-wrap { flex: 1; min-width: 0; }
.check-evidence { color: #6e7681; font-size: 0.74rem; }

.evidence-details { display: inline; }
.evidence-summary {
  color: #6e7681; font-size: 0.74rem; cursor: pointer; list-style: none; display: inline;
}
.evidence-summary::-webkit-details-marker { display: none; }
.evidence-summary::after {
  content: ' Show more'; font-size: 0.68rem; color: #58a6ff; font-weight: 500; margin-left: 4px;
}
.evidence-details[open] > .evidence-summary { display: none; }
.evidence-full {
  color: #6e7681; font-size: 0.72rem; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  white-space: pre-wrap; word-break: break-word; margin-top: 4px;
  padding: 8px 10px; background: #0d1117; border-radius: 4px; border: 1px solid #1c2028;
  line-height: 1.5; max-height: 300px; overflow-y: auto;
}
.evidence-full::-webkit-scrollbar { width: 4px; }
.evidence-full::-webkit-scrollbar-track { background: transparent; }
.evidence-full::-webkit-scrollbar-thumb { background: #30363d; border-radius: 2px; }

/* Responsive: hide sidebar on small screens */
@media (max-width: 768px) {
  .sidebar { position: fixed; z-index: 50; left: 0; top: 0; }
  .sidebar.collapsed { margin-left: -220px; }
  .main-content { padding: 0 16px 64px; }
}
"""

JS = """
/* ── Toggle functions ── */
function toggleSkill(header) {
  const card = header.closest('.skill-card');
  const opening = !card.classList.contains('open');
  card.classList.remove('settled');
  card.classList.toggle('open');
  header.classList.toggle('expanded');
  if (!opening) return;
  const body = card.querySelector('.skill-body');
  body.addEventListener('transitionend', () => card.classList.add('settled'), { once: true });
}

function toggleEval(header) {
  const row = header.closest('.eval-row');
  const opening = !row.classList.contains('open');
  row.classList.remove('settled');
  row.classList.toggle('open');
  header.classList.toggle('expanded');
  if (!opening) return;
  const body = row.querySelector('.eval-body');
  body.addEventListener('transitionend', () => row.classList.add('settled'), { once: true });
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

function expandAll() {
  document.querySelectorAll('.skill-card').forEach(c => {
    c.classList.add('open', 'settled');
    c.querySelector('.skill-header').classList.add('expanded');
  });
  document.querySelectorAll('.eval-row').forEach(r => {
    r.classList.add('open', 'settled');
    r.querySelector('.eval-header').classList.add('expanded');
  });
}

function collapseAll() {
  document.querySelectorAll('.skill-card').forEach(c => {
    c.classList.remove('open', 'settled');
    c.querySelector('.skill-header').classList.remove('expanded');
  });
  document.querySelectorAll('.eval-row').forEach(r => {
    r.classList.remove('open', 'settled');
    r.querySelector('.eval-header').classList.remove('expanded');
  });
}

/* ── Filters ── */
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    document.querySelectorAll('.skill-card').forEach(card => {
      card.style.display = (filter === 'all' || card.dataset.status === filter) ? '' : 'none';
    });
    // Also filter sidebar nav
    document.querySelectorAll('.nav-item').forEach(item => {
      const skillCard = document.getElementById('skill-' + item.dataset.skill);
      item.style.display = (skillCard && skillCard.style.display === 'none') ? 'none' : '';
    });
  });
});

/* ── Sidebar active tracking on scroll ── */
const skillCards = Array.from(document.querySelectorAll('.skill-card'));
const navItems = document.querySelectorAll('.nav-item');

function updateActiveNav() {
  let current = '';
  for (const card of skillCards) {
    const rect = card.getBoundingClientRect();
    if (rect.top <= 120) current = card.id;
  }
  navItems.forEach(item => {
    item.classList.toggle('active', 'skill-' + item.dataset.skill === current);
  });
}
document.querySelector('.main-content')?.addEventListener('scroll', updateActiveNav);
window.addEventListener('scroll', updateActiveNav);
updateActiveNav();

/* ── Keyboard navigation ── */
let focusIndex = -1;
const focusable = () => Array.from(document.querySelectorAll('.skill-card:not([style*="display: none"]), .eval-row'));

function setFocus(idx) {
  const items = focusable();
  // Clear previous
  document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
  if (idx < 0 || idx >= items.length) return;
  focusIndex = idx;
  const el = items[idx];
  el.classList.add('focused');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.addEventListener('keydown', (e) => {
  // Don't capture when typing in inputs
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  const items = focusable();

  if (e.key === 'j' || e.key === 'ArrowDown') {
    e.preventDefault();
    setFocus(Math.min(focusIndex + 1, items.length - 1));
  } else if (e.key === 'k' || e.key === 'ArrowUp') {
    e.preventDefault();
    setFocus(Math.max(focusIndex - 1, 0));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const el = items[focusIndex];
    if (!el) return;
    if (el.classList.contains('skill-card')) {
      toggleSkill(el.querySelector('.skill-header'));
    } else if (el.classList.contains('eval-row')) {
      toggleEval(el.querySelector('.eval-header'));
    }
  } else if (e.key === 'Escape') {
    document.querySelectorAll('.focused').forEach(el => el.classList.remove('focused'));
    focusIndex = -1;
  }
});

/* ── Smooth scroll for sidebar nav links ── */
document.querySelectorAll('.nav-item').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Auto-expand the skill
      if (!target.classList.contains('open')) {
        toggleSkill(target.querySelector('.skill-header'));
      }
    }
  });
});
"""


def main():
    parser = argparse.ArgumentParser(description="Generate HTML report from eval results")
    parser.add_argument("results_dir", help="Path to results directory containing <skill>.json files")
    parser.add_argument("--output", "-o", default=None, help="Output HTML file (default: <results_dir>/report.html)")
    args = parser.parse_args()

    results_dir = Path(args.results_dir)
    if not results_dir.is_dir():
        print(f"Error: {results_dir} is not a directory", file=sys.stderr)
        sys.exit(1)

    results = load_results(results_dir)
    if not results:
        print(f"Error: No result files found in {results_dir}", file=sys.stderr)
        sys.exit(1)

    html_content = generate_html(results, results_dir)

    output_path = Path(args.output) if args.output else results_dir / "report.html"
    output_path.write_text(html_content)
    print(f"Report generated: {output_path}")


if __name__ == "__main__":
    main()
