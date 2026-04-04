#!/usr/bin/env python3
"""Scenario-based eval harness for Copilot Studio skills.

Runs end-to-end scenarios via claude/copilot CLI in non-interactive mode,
then validates routing (agents/skills invoked) and output (files, response)
against deterministic checks. Skills inside sub-agents are traced via a
PreToolUse hook injected at runtime.

Usage:
    python evals/evaluate.py --scenario agent-settings [--eval-id 1] [--cli copilot] [--verbose]
"""

import argparse
import fnmatch
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURES_DIR = REPO_ROOT / "evals" / "fixtures"
MOCKS_DIR = REPO_ROOT / "evals" / "mocks"
RESULTS_DIR = REPO_ROOT / "evals" / "results"
SKILLS_DIR = REPO_ROOT / "skills"
SCRIPTS_DIR = REPO_ROOT / "scripts"


EVALS_SCENARIOS_DIR = REPO_ROOT / "evals" / "scenarios"


def load_evals(scenario_name: str) -> dict:
    """Load eval definition from evals/scenarios/<name>.json."""
    evals_path = EVALS_SCENARIOS_DIR / f"{scenario_name}.json"
    if not evals_path.exists():
        print(f"Error: No evals found for scenario '{scenario_name}' in evals/scenarios/", file=sys.stderr)
        sys.exit(1)
    return json.loads(evals_path.read_text())


def setup_workspace(fixture_name: str) -> Path:
    """Copy a fixture agent dir into a temp workspace. Returns the workspace path."""
    fixture_path = FIXTURES_DIR / fixture_name
    if not fixture_path.exists():
        raise FileNotFoundError(f"Fixture not found: {fixture_path}")

    workspace = Path(tempfile.mkdtemp(prefix="skill-eval-"))
    shutil.copytree(fixture_path, workspace / "agent", dirs_exist_ok=True)
    return workspace


def snapshot_files(directory: Path) -> dict[str, str]:
    """Take a snapshot of all files with content hashes for reliable change detection."""
    snapshot = {}
    for f in directory.rglob("*"):
        if f.is_file():
            try:
                content = f.read_bytes()
                snapshot[f.relative_to(directory).as_posix()] = hashlib.sha256(content).hexdigest()
            except (PermissionError, OSError):
                pass
    return snapshot


def find_new_or_modified_files(directory: Path, before: dict[str, str]) -> list[Path]:
    """Find files that are new or modified since the snapshot."""
    after = snapshot_files(directory)
    changed = []
    for rel_path, file_hash in after.items():
        if rel_path not in before or file_hash != before[rel_path]:
            changed.append(directory / rel_path)
    return changed


def setup_mocks(workspace: Path, mock_scripts: list[str]) -> None:
    """Copy mock scripts over real bundle.js files in the workspace."""
    for script_name in mock_scripts:
        mock_src = MOCKS_DIR / script_name
        if not mock_src.exists():
            print(f"Warning: Mock not found: {mock_src}", file=sys.stderr)
            continue
        # The skills reference scripts via ${CLAUDE_SKILL_DIR}/../../scripts/
        # In the workspace, we place them where they'd be found
        mock_dst = workspace / "scripts" / script_name
        mock_dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(mock_src, mock_dst)


HOOK_SCRIPT = REPO_ROOT / "evals" / "hooks" / "log-skill-use.js"


def run_cli(cli: str, prompt: str, cwd: Path, timeout: int = 600) -> tuple[str, int, list[str], list[str], bool]:
    """Run claude/copilot in non-interactive mode and return (response_text, exit_code, skills_invoked, agents_invoked, skill_tracing).

    Supports both Claude Code and GitHub Copilot CLI JSON output formats.
    Uses stream-json with verbose for Claude Code to capture skill/agent invocations.
    Skills invoked inside sub-agents are captured via a PreToolUse hook.
    """
    cmd = [cli, "-p", prompt]

    # Skill log file — PreToolUse hook writes here, we read after
    fd, skill_log_str = tempfile.mkstemp(prefix="skill-log-", suffix=".txt")
    os.close(fd)
    skill_log = Path(skill_log_str)

    # Grant tool permissions — different flags per CLI
    skill_tracing = False
    if cli == "copilot":
        cmd.extend(["--output-format", "json"])
        cmd.extend(["--allow-tool", "shell(node *)", "--allow-tool", "read",
                     "--allow-tool", "write", "--allow-tool", "edit",
                     "--allow-tool", "glob"])
    else:
        cmd.extend(["--output-format", "stream-json", "--verbose"])
        cmd.extend(["--allowedTools", "Bash(node *) Read Write Glob Edit"])
        # Inject PreToolUse hook to trace skill invocations inside sub-agents
        # Use forward slashes for cross-platform compatibility in node command
        hook_path = str(HOOK_SCRIPT).replace("\\", "/")
        hook_settings = json.dumps({
            "hooks": {
                "PreToolUse": [{
                    "matcher": "Skill",
                    "hooks": [{
                        "type": "command",
                        "command": f"node \"{hook_path}\""
                    }]
                }]
            }
        })
        cmd.extend(["--settings", hook_settings])
        skill_tracing = True

    # Remove CLAUDECODE env var to allow nesting (same as skill-creator)
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}
    env["EVAL_SKILL_LOG"] = str(skill_log)

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(cwd),
            env=env,
            timeout=timeout,
        )
    except subprocess.TimeoutExpired:
        skill_log.unlink(missing_ok=True)
        return "[TIMEOUT]", 1, [], [], False

    response_text = ""
    exit_code = result.returncode
    skills_invoked = []
    agents_invoked = []

    # Read skill log from hook (captures skills invoked at all levels, including sub-agents)
    if skill_log.exists():
        skills_invoked = [line.strip() for line in skill_log.read_text().splitlines() if line.strip()]
        skill_log.unlink(missing_ok=True)

    # Parse JSON lines from stdout
    for line in result.stdout.strip().split("\n"):
        line = line.strip()
        if not line:
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue

        event_type = event.get("type", "")

        # Claude Code: result event with response text
        if event_type == "result" and "result" in event:
            response_text = event["result"]

        # Claude Code stream-json: assistant messages with tool_use for agents
        elif event_type == "assistant":
            message = event.get("message", {})
            for content in message.get("content", []):
                if content.get("type") == "tool_use":
                    tool_name = content.get("name", "")
                    tool_input = content.get("input", {})
                    if tool_name == "Agent":
                        agent_type = tool_input.get("subagent_type", "")
                        if agent_type:
                            agents_invoked.append(agent_type)

        # Copilot CLI: assistant.message with full content
        elif event_type == "assistant.message":
            data = event.get("data", {})
            content = data.get("content", "")
            if content:
                response_text = content.strip()

    return response_text, exit_code, skills_invoked, agents_invoked, skill_tracing


# --- Check functions ---

def check_files_created(workspace: Path, changed_files: list[Path], spec: list[dict]) -> list[dict]:
    """Check that expected file patterns were created or modified."""
    results = []
    agent_dir = workspace / "agent"
    for item in spec:
        pattern = item["pattern"]
        min_count = item.get("min_count", 1)
        max_count = item.get("max_count", None)
        # Only match against new/modified files, not pre-existing fixture files
        matches = [f for f in changed_files if f.is_relative_to(agent_dir) and fnmatch.fnmatch(f.relative_to(agent_dir).as_posix(), pattern)]
        passed = len(matches) >= min_count
        if max_count is not None:
            passed = passed and len(matches) <= max_count
        label = f"files_created: {pattern} (min {min_count})" if max_count is None else f"files_created: {pattern} (min {min_count}, max {max_count})"
        results.append({
            "check": label,
            "passed": passed,
            "evidence": f"Found {len(matches)} new/modified files: {[str(m.relative_to(agent_dir)) for m in matches]}" if matches else "No matching new/modified files found",
        })
    return results


def check_schema_validate(workspace: Path, changed_files: list[Path]) -> list[dict]:
    """Run schema-lookup.bundle.js validate on new/modified YAML files."""
    results = []
    schema_script = SCRIPTS_DIR / "schema-lookup.bundle.js"
    if not schema_script.exists():
        return [{"check": "schema_validate", "passed": False, "evidence": f"Script not found: {schema_script}"}]

    yaml_files = [f for f in changed_files if f.name.endswith(".mcs.yml")]
    if not yaml_files:
        return [{"check": "schema_validate", "passed": False, "evidence": "No .mcs.yml files to validate"}]

    for yaml_file in yaml_files:
        try:
            proc = subprocess.run(
                ["node", str(schema_script), "validate", str(yaml_file)],
                capture_output=True, text=True, timeout=30,
            )
            output = proc.stdout + proc.stderr
            # schema-lookup validate outputs lines with [PASS], [WARN], [FAIL]
            has_fail = "[FAIL]" in output or "[fail]" in output.lower()
            passed = proc.returncode == 0 and not has_fail
            results.append({
                "check": f"schema_validate: {yaml_file.name}",
                "passed": passed,
                "evidence": output[:500] if output else "(no output)",
            })
        except subprocess.TimeoutExpired:
            results.append({
                "check": f"schema_validate: {yaml_file.name}",
                "passed": False,
                "evidence": "Validation timed out",
            })
    return results


def _navigate_yaml_path(data, path: str):
    """Navigate a dotted path through YAML data, supporting array indices."""
    value = data
    for key in path.split("."):
        if value is None:
            break
        if isinstance(value, list):
            try:
                value = value[int(key)]
            except (ValueError, IndexError):
                value = None
        elif isinstance(value, dict):
            value = value.get(key)
        else:
            value = None
    return value


def check_yaml_structure(workspace: Path, changed_files: list[Path], specs: list[dict]) -> list[dict]:
    """Check specific YAML paths for expected values."""
    results = []
    try:
        import yaml
    except ImportError:
        return [{"check": "yaml_structure", "passed": False, "evidence": "PyYAML not installed"}]

    agent_dir = workspace / "agent"
    all_yaml = [f for f in changed_files if f.name.endswith(".mcs.yml")]
    if not all_yaml:
        return [{"check": "yaml_structure", "passed": False, "evidence": "No .mcs.yml files found"}]

    for spec in specs:
        path = spec["path"]
        file_pattern = spec.get("file")

        # Filter to matching files if a file selector is provided
        if file_pattern:
            yaml_files = [f for f in all_yaml
                          if f.is_relative_to(agent_dir)
                          and fnmatch.fnmatch(f.relative_to(agent_dir).as_posix(), file_pattern)]
            if not yaml_files:
                results.append({
                    "check": f"yaml_structure: {path} in {file_pattern}",
                    "passed": False,
                    "evidence": f"No changed files matching '{file_pattern}'",
                })
                continue
        else:
            yaml_files = all_yaml

        for yaml_file in yaml_files:
            data = yaml.safe_load(yaml_file.read_text())
            value = _navigate_yaml_path(data, path)
            file_label = yaml_file.name

            if "equals" in spec:
                passed = value == spec["equals"]
                results.append({
                    "check": f"yaml_structure: {path} == {spec['equals']} in {file_label}",
                    "passed": passed,
                    "evidence": f"Actual value: {value}",
                })
            elif "min_length" in spec:
                actual_len = len(value) if isinstance(value, (list, dict, str)) else 0
                passed = actual_len >= spec["min_length"]
                results.append({
                    "check": f"yaml_structure: {path} min_length {spec['min_length']} in {file_label}",
                    "passed": passed,
                    "evidence": f"Actual length: {actual_len}",
                })
            elif "contains" in spec:
                text = str(value).lower() if value else ""
                passed = spec["contains"].lower() in text
                results.append({
                    "check": f"yaml_structure: {path} contains '{spec['contains']}' in {file_label}",
                    "passed": passed,
                    "evidence": f"Value: {str(value)[:200]}",
                })
    return results


def check_content_contains(workspace: Path, changed_files: list[Path], keywords: list[str]) -> list[dict]:
    """Check that output files contain expected keywords."""
    results = []
    all_content = ""
    for f in changed_files:
        try:
            all_content += f.read_text()
        except (UnicodeDecodeError, IsADirectoryError):
            pass

    for keyword in keywords:
        passed = keyword.lower() in all_content.lower()
        results.append({
            "check": f"content_contains: '{keyword}'",
            "passed": passed,
            "evidence": f"{'Found' if passed else 'Not found'} in {len(changed_files)} output file(s)",
        })
    return results


def check_no_placeholders(workspace: Path, changed_files: list[Path]) -> list[dict]:
    """Check that no placeholder markers remain in output files."""
    patterns = [r"_REPLACE", r"\bTODO\b", r"\bFIXME\b"]
    results = []
    for f in changed_files:
        try:
            content = f.read_text()
        except (UnicodeDecodeError, IsADirectoryError):
            continue
        for pattern in patterns:
            matches = re.findall(pattern, content)
            if matches:
                results.append({
                    "check": f"no_placeholders: {pattern} in {f.name}",
                    "passed": False,
                    "evidence": f"Found {len(matches)} occurrences",
                })
    if not results:
        results.append({
            "check": "no_placeholders",
            "passed": True,
            "evidence": "No placeholders found",
        })
    return results


def check_yaml_unchanged(workspace: Path, before_snapshot: dict[str, str], specs: list[dict],
                         before_content: dict[str, str] | None = None) -> list[dict]:
    """Check that specific files or YAML paths were NOT changed by the skill."""
    results = []
    agent_dir = workspace / "agent"

    for spec in specs:
        file_pattern = spec.get("file", "")
        yaml_path = spec.get("path")

        matching = [rel for rel in before_snapshot if fnmatch.fnmatch(rel, file_pattern)]

        if not matching:
            results.append({
                "check": f"yaml_unchanged: {file_pattern}",
                "passed": False,
                "evidence": f"No fixture files matching '{file_pattern}'",
            })
            continue

        for rel_path in matching:
            current_file = agent_dir / rel_path
            if not current_file.exists():
                results.append({
                    "check": f"yaml_unchanged: {rel_path}",
                    "passed": False,
                    "evidence": "File was deleted",
                })
                continue

            if yaml_path:
                if not before_content or rel_path not in before_content:
                    results.append({
                        "check": f"yaml_unchanged: {rel_path} -> {yaml_path}",
                        "passed": False,
                        "evidence": "No before-content captured for path comparison",
                    })
                    continue
                try:
                    import yaml
                    before_data = yaml.safe_load(before_content[rel_path])
                    current_data = yaml.safe_load(current_file.read_text())
                    before_val = _navigate_yaml_path(before_data, yaml_path)
                    current_val = _navigate_yaml_path(current_data, yaml_path)
                    passed = before_val == current_val
                    results.append({
                        "check": f"yaml_unchanged: {rel_path} -> {yaml_path}",
                        "passed": passed,
                        "evidence": "Unchanged" if passed else f"Before: {str(before_val)[:100]}, After: {str(current_val)[:100]}",
                    })
                except ImportError:
                    results.append({"check": "yaml_unchanged", "passed": False, "evidence": "PyYAML not installed"})
            else:
                current_hash = hashlib.sha256(current_file.read_bytes()).hexdigest()
                passed = before_snapshot[rel_path] == current_hash
                results.append({
                    "check": f"yaml_unchanged: {rel_path}",
                    "passed": passed,
                    "evidence": "File unchanged" if passed else "File was modified",
                })

    return results


def check_stdout_contains(response_text: str, keywords: list[str]) -> list[dict]:
    """Check that CLI response text contains expected strings."""
    results = []
    for keyword in keywords:
        passed = keyword.lower() in response_text.lower()
        results.append({
            "check": f"stdout_contains: '{keyword}'",
            "passed": passed,
            "evidence": f"{'Found' if passed else 'Not found'} in response ({len(response_text)} chars)",
        })
    return results


def check_stdout_not_contains(response_text: str, keywords: list[str]) -> list[dict]:
    """Check that CLI response text does NOT contain error strings."""
    results = []
    for keyword in keywords:
        found = keyword.lower() in response_text.lower()
        results.append({
            "check": f"stdout_not_contains: '{keyword}'",
            "passed": not found,
            "evidence": f"{'Found (FAIL)' if found else 'Not found (OK)'} in response",
        })
    return results


def run_checks(
    workspace: Path,
    changed_files: list[Path],
    response_text: str,
    exit_code: int,
    checks: dict,
    skills_invoked: list[str] | None = None,
    agents_invoked: list[str] | None = None,
    before_snapshot: dict[str, str] | None = None,
    before_content: dict[str, str] | None = None,
    skill_tracing_available: bool = True,
) -> list[dict]:
    """Run all configured checks and return results."""
    all_results = []

    # skill_invoked check
    if "skill_invoked" in checks:
        if not skill_tracing_available:
            all_results.append({
                "check": f"skill_invoked: {checks['skill_invoked']}",
                "passed": True,
                "evidence": "Skipped — skill tracing not available with Copilot CLI",
            })
        else:
            expected = checks["skill_invoked"]
            found = expected in (skills_invoked or [])
            if found:
                evidence = f"Correct — {expected} was invoked"
            elif skills_invoked:
                evidence = f"Wrong skill routed: expected {expected}, got {', '.join(skills_invoked)}"
            else:
                evidence = f"No skills were invoked — expected {expected}"
            all_results.append({
                "check": f"skill_invoked: {expected}",
                "passed": found,
                "evidence": evidence,
            })

    # skill_not_invoked check
    if "skill_not_invoked" in checks:
        if not skill_tracing_available:
            all_results.append({
                "check": "skill_not_invoked",
                "passed": True,
                "evidence": "Skipped — skill tracing not available with Copilot CLI",
            })
        else:
            for unwanted in checks["skill_not_invoked"]:
                found = unwanted in (skills_invoked or [])
                all_results.append({
                    "check": f"skill_not_invoked: {unwanted}",
                    "passed": not found,
                    "evidence": f"{'Found (FAIL)' if found else 'Not found (OK)'}",
                })

    # agent_invoked check
    if "agent_invoked" in checks:
        expected = checks["agent_invoked"]
        found = expected in (agents_invoked or [])
        if found:
            evidence = f"Correct — {expected} was invoked"
        elif agents_invoked:
            evidence = f"Wrong agent routed: expected {expected}, got {', '.join(agents_invoked)}"
        else:
            evidence = f"No agents were invoked — expected {expected}"
        all_results.append({
            "check": f"agent_invoked: {expected}",
            "passed": found,
            "evidence": evidence,
        })

    # agent_not_invoked check
    if "agent_not_invoked" in checks:
        for unwanted in checks["agent_not_invoked"]:
            found = unwanted in (agents_invoked or [])
            all_results.append({
                "check": f"agent_not_invoked: {unwanted}",
                "passed": not found,
                "evidence": f"{'Found (FAIL)' if found else 'Not found (OK)'}",
            })

    if "files_created" in checks:
        all_results.extend(check_files_created(workspace, changed_files, checks["files_created"]))

    if checks.get("schema_validate"):
        all_results.extend(check_schema_validate(workspace, changed_files))

    if "yaml_structure" in checks:
        all_results.extend(check_yaml_structure(workspace, changed_files, checks["yaml_structure"]))

    if "content_contains" in checks:
        all_results.extend(check_content_contains(workspace, changed_files, checks["content_contains"]))

    # Auto-run no_placeholders when YAML files were changed, unless explicitly disabled
    no_ph = checks.get("no_placeholders")
    if no_ph is True or (no_ph is None and any(f.name.endswith(".mcs.yml") for f in changed_files)):
        all_results.extend(check_no_placeholders(workspace, changed_files))

    if "yaml_unchanged" in checks and before_snapshot is not None:
        all_results.extend(check_yaml_unchanged(workspace, before_snapshot, checks["yaml_unchanged"], before_content))

    if "stdout_contains" in checks:
        all_results.extend(check_stdout_contains(response_text, checks["stdout_contains"]))

    if "stdout_not_contains" in checks:
        all_results.extend(check_stdout_not_contains(response_text, checks["stdout_not_contains"]))

    if "exit_code" in checks:
        expected = checks["exit_code"]
        all_results.append({
            "check": f"exit_code == {expected}",
            "passed": exit_code == expected,
            "evidence": f"Actual exit code: {exit_code}",
        })

    return all_results


def run_eval(eval_item: dict, cli: str, verbose: bool, artifacts_dir: Path | None = None) -> dict:
    """Run a single eval and return results."""
    eval_id = eval_item["id"]
    eval_name = eval_item.get("name", "")
    prompt = eval_item["prompt"]
    fixture = eval_item.get("fixture", "basic-agent")
    mock_scripts = eval_item.get("mock_scripts", [])
    checks = eval_item.get("checks", {})

    if verbose:
        print(f"\n--- Eval {eval_id}: {eval_name or prompt[:80]} ---", file=sys.stderr)
        print(f"Prompt: {prompt}", file=sys.stderr)
        print(f"Fixture: {fixture}", file=sys.stderr)
        checks_summary = ", ".join(k for k, v in checks.items() if v)
        print(f"Checks: {checks_summary}", file=sys.stderr)

    # Setup workspace
    workspace = setup_workspace(fixture)
    agent_dir = workspace / "agent"

    try:
        # Setup mocks if needed
        if mock_scripts:
            setup_mocks(workspace, mock_scripts)

        # Snapshot files before running
        before = snapshot_files(agent_dir)

        # Capture file contents for yaml_unchanged path comparisons
        before_content = {}
        if "yaml_unchanged" in checks:
            for f in agent_dir.rglob("*.mcs.yml"):
                if f.is_file():
                    try:
                        before_content[f.relative_to(agent_dir).as_posix()] = f.read_text()
                    except (PermissionError, OSError, UnicodeDecodeError):
                        pass

        # Run CLI
        if verbose:
            print(f"Running: {cli} -p ...", file=sys.stderr)

        response_text, exit_code, skills_invoked, agents_invoked, skill_tracing = run_cli(cli, prompt, cwd=agent_dir)

        if verbose:
            print(f"Exit code: {exit_code}", file=sys.stderr)
            if skills_invoked:
                print(f"Skills invoked: {skills_invoked}", file=sys.stderr)
            if agents_invoked:
                print(f"Agents invoked: {agents_invoked}", file=sys.stderr)
            print(f"Response: {response_text[:200]}...", file=sys.stderr)

        # Find changed files
        changed_files = find_new_or_modified_files(agent_dir, before)

        # Filter to files within agent_dir only
        changed_files = [f for f in changed_files if f.is_relative_to(agent_dir)]

        if verbose:
            print(f"Changed files: {[str(f.relative_to(agent_dir)) for f in changed_files]}", file=sys.stderr)

        # Run checks
        check_results = run_checks(workspace, changed_files, response_text, exit_code, checks, skills_invoked, agents_invoked, before, before_content, skill_tracing)

        passed = sum(1 for r in check_results if r["passed"])
        total = len(check_results)
        failed = total - passed

        # Determine eval status
        if failed == 0:
            eval_status = "passed"
        else:
            eval_status = "failed"

        if verbose:
            for r in check_results:
                label = "PASS" if r["passed"] else "FAIL"
                print(f"  [{label}] {r['check']}: {r['evidence']}", file=sys.stderr)
            print(f"Result: {passed}/{total} checks passed", file=sys.stderr)

        # Save generated files as artifacts
        saved_artifacts = []
        if artifacts_dir and changed_files:
            eval_artifacts = artifacts_dir / f"eval-{eval_id}"
            eval_artifacts.mkdir(parents=True, exist_ok=True)
            for f in changed_files:
                if not f.is_relative_to(agent_dir):
                    continue
                rel = f.relative_to(agent_dir)
                # Prevent path traversal (e.g., symlinks or ".." components)
                if ".." in rel.parts:
                    continue
                dest = eval_artifacts / rel
                if not dest.resolve().is_relative_to(eval_artifacts.resolve()):
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(f, dest)
                # Use posix paths for cross-platform HTML href compatibility
                saved_artifacts.append(dest.relative_to(artifacts_dir).as_posix())

        return {
            "eval_id": eval_id,
            "name": eval_name,
            "prompt": prompt,
            "fixture": fixture,
            "response_text": response_text[:5000] + ("[...truncated]" if len(response_text) > 5000 else ""),
            "exit_code": exit_code,
            "skills_invoked": skills_invoked,
            "agents_invoked": agents_invoked,
            "changed_files": [str(f.relative_to(agent_dir)) for f in changed_files],
            "artifacts": saved_artifacts,
            "checks": check_results,
            "summary": {"passed": passed, "failed": failed, "total": total, "status": eval_status},
        }
    finally:
        shutil.rmtree(workspace, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description="Skill result testing harness")
    parser.add_argument("--skill", "--scenario", required=True, dest="skill", help="Scenario name to test")
    parser.add_argument("--eval-id", type=int, default=None, help="Run specific eval by ID")
    parser.add_argument("--cli", default="claude", help="CLI binary: 'claude' or 'copilot' (default: claude)")
    parser.add_argument("--verbose", action="store_true", help="Print progress to stderr")
    parser.add_argument("--output", default=None, help="Output results to file (default: stdout)")
    parser.add_argument("--artifacts-dir", default=None, help="Save generated files to this directory")
    parser.add_argument("--parallel", type=int, default=1, metavar="N",
                        help="Run N evals in parallel (default: 1, recommended: 3)")
    args = parser.parse_args()

    if args.cli == "copilot":
        print("Warning: Copilot CLI does not support runtime hook injection. "
              "skill_invoked/skill_not_invoked checks will be skipped.", file=sys.stderr)

    evals_data = load_evals(args.skill)
    evals_to_run = evals_data["evals"]

    if args.eval_id is not None:
        evals_to_run = [e for e in evals_to_run if e["id"] == args.eval_id]
        if not evals_to_run:
            print(f"Error: Eval ID {args.eval_id} not found", file=sys.stderr)
            sys.exit(1)

    # Determine artifacts directory
    artifacts_dir = None
    if args.artifacts_dir:
        artifacts_dir = Path(args.artifacts_dir)
    elif args.output:
        # Place artifacts alongside the output file: <output_dir>/<skill_name>/
        artifacts_dir = Path(args.output).parent / evals_data.get("scenario_name", evals_data.get("skill_name", args.skill))
    artifacts_dir and artifacts_dir.mkdir(parents=True, exist_ok=True)

    import time
    parallel = max(1, args.parallel)
    if args.verbose:
        mode = f"parallel ({parallel} workers)" if parallel > 1 else "sequential"
        print(f"Running {len(evals_to_run)} eval(s) for skill '{args.skill}' with {args.cli} ({mode})", file=sys.stderr)

    start_time = time.time()

    if parallel > 1 and len(evals_to_run) > 1:
        from concurrent.futures import ThreadPoolExecutor, as_completed
        results = [None] * len(evals_to_run)
        with ThreadPoolExecutor(max_workers=parallel) as pool:
            future_to_idx = {
                pool.submit(run_eval, eval_item, args.cli, args.verbose, artifacts_dir): i
                for i, eval_item in enumerate(evals_to_run)
            }
            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                results[idx] = future.result()
    else:
        results = []
        for eval_item in evals_to_run:
            result = run_eval(eval_item, args.cli, args.verbose, artifacts_dir)
            results.append(result)

    duration_sec = round(time.time() - start_time, 1)

    output = {
        "scenario_name": evals_data.get("scenario_name", evals_data.get("skill_name", args.skill)),
        "cli": args.cli,
        "parallel": parallel,
        "duration_sec": duration_sec,
        "results": results,
        "summary": {
            "total_evals": len(results),
            "total_checks_passed": sum(r["summary"]["passed"] for r in results),
            "total_checks_failed": sum(r["summary"]["failed"] for r in results),
            "total_checks": sum(r["summary"]["total"] for r in results),
        },
    }

    output_json = json.dumps(output, indent=2)

    if args.output:
        Path(args.output).write_text(output_json)
        if args.verbose:
            print(f"Results written to {args.output}", file=sys.stderr)
            if artifacts_dir:
                print(f"Artifacts saved to {artifacts_dir}", file=sys.stderr)
    else:
        print(output_json)


if __name__ == "__main__":
    main()
