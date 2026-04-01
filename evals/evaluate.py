#!/usr/bin/env python3
"""Skill result testing harness for Copilot Studio skills.

Runs a skill via claude/copilot CLI in non-interactive mode, then validates
the output (files created, response text) against deterministic checks.

Usage:
    python evals/evaluate.py --skill new-topic [--eval-id 1] [--cli copilot] [--verbose]
"""

import argparse
import fnmatch
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


def load_evals(skill_name: str) -> dict:
    """Load evals.json for a skill."""
    evals_path = SKILLS_DIR / skill_name / "evals" / "evals.json"
    if not evals_path.exists():
        print(f"Error: No evals found at {evals_path}", file=sys.stderr)
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


def snapshot_files(directory: Path) -> dict[str, float]:
    """Take a snapshot of all files and their modification times."""
    snapshot = {}
    for f in directory.rglob("*"):
        if f.is_file():
            snapshot[str(f.relative_to(directory))] = f.stat().st_mtime
    return snapshot


def find_new_or_modified_files(directory: Path, before: dict[str, float]) -> list[Path]:
    """Find files that are new or modified since the snapshot."""
    after = snapshot_files(directory)
    changed = []
    for rel_path, mtime in after.items():
        if rel_path not in before or mtime > before[rel_path]:
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


def run_cli(cli: str, prompt: str, cwd: Path, timeout: int = 600) -> tuple[str, int]:
    """Run claude/copilot in non-interactive mode and return (response_text, exit_code).

    Supports both Claude Code and GitHub Copilot CLI JSON output formats.
    """
    cmd = [cli, "-p", prompt, "--output-format", "json",
           "--allowedTools", "Bash(node *) Read Write Glob Edit"]

    # Remove CLAUDECODE env var to allow nesting (same as skill-creator)
    env = {k: v for k, v in os.environ.items() if k != "CLAUDECODE"}

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
        return "[TIMEOUT]", 1

    response_text = ""
    exit_code = result.returncode

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

        # Claude Code: single result event with response text
        if event_type == "result" and "result" in event:
            response_text = event["result"]

        # Copilot CLI: assistant.message with full content
        elif event_type == "assistant.message":
            data = event.get("data", {})
            content = data.get("content", "")
            if content:
                response_text = content.strip()

    return response_text, exit_code


# --- Check functions ---

def check_files_created(workspace: Path, changed_files: list[Path], spec: list[dict]) -> list[dict]:
    """Check that expected file patterns were created or modified."""
    results = []
    agent_dir = workspace / "agent"
    for item in spec:
        pattern = item["pattern"]
        min_count = item.get("min_count", 1)
        # Only match against new/modified files, not pre-existing fixture files
        matches = [f for f in changed_files if fnmatch.fnmatch(str(f.relative_to(agent_dir)), pattern)]
        passed = len(matches) >= min_count
        results.append({
            "check": f"files_created: {pattern} (min {min_count})",
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


def check_yaml_structure(workspace: Path, changed_files: list[Path], specs: list[dict]) -> list[dict]:
    """Check specific YAML paths for expected values."""
    results = []
    try:
        import yaml
    except ImportError:
        return [{"check": "yaml_structure", "passed": False, "evidence": "PyYAML not installed"}]

    yaml_files = [f for f in changed_files if f.name.endswith(".mcs.yml")]
    if not yaml_files:
        return [{"check": "yaml_structure", "passed": False, "evidence": "No .mcs.yml files found"}]

    for spec in specs:
        path = spec["path"]
        for yaml_file in yaml_files:
            data = yaml.safe_load(yaml_file.read_text())
            # Navigate the dotted path
            value = data
            for key in path.split("."):
                if isinstance(value, dict):
                    value = value.get(key)
                else:
                    value = None
                    break

            if "equals" in spec:
                passed = value == spec["equals"]
                results.append({
                    "check": f"yaml_structure: {path} == {spec['equals']} in {yaml_file.name}",
                    "passed": passed,
                    "evidence": f"Actual value: {value}",
                })
            elif "min_length" in spec:
                actual_len = len(value) if isinstance(value, (list, dict, str)) else 0
                passed = actual_len >= spec["min_length"]
                results.append({
                    "check": f"yaml_structure: {path} min_length {spec['min_length']} in {yaml_file.name}",
                    "passed": passed,
                    "evidence": f"Actual length: {actual_len}",
                })
            elif "contains" in spec:
                text = str(value).lower() if value else ""
                passed = spec["contains"].lower() in text
                results.append({
                    "check": f"yaml_structure: {path} contains '{spec['contains']}' in {yaml_file.name}",
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
) -> list[dict]:
    """Run all configured checks and return results."""
    all_results = []

    if "files_created" in checks:
        all_results.extend(check_files_created(workspace, changed_files, checks["files_created"]))

    if checks.get("schema_validate"):
        all_results.extend(check_schema_validate(workspace, changed_files))

    if "yaml_structure" in checks:
        all_results.extend(check_yaml_structure(workspace, changed_files, checks["yaml_structure"]))

    if "content_contains" in checks:
        all_results.extend(check_content_contains(workspace, changed_files, checks["content_contains"]))

    if checks.get("no_placeholders"):
        all_results.extend(check_no_placeholders(workspace, changed_files))

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


def run_eval(eval_item: dict, cli: str, verbose: bool) -> dict:
    """Run a single eval and return results."""
    eval_id = eval_item["id"]
    prompt = eval_item["prompt"]
    fixture = eval_item.get("fixture", "basic-agent")
    mock_scripts = eval_item.get("mock_scripts", [])
    checks = eval_item.get("checks", {})

    if verbose:
        print(f"\n--- Eval {eval_id} ---", file=sys.stderr)
        print(f"Prompt: {prompt[:100]}...", file=sys.stderr)
        print(f"Fixture: {fixture}", file=sys.stderr)

    # Setup workspace
    workspace = setup_workspace(fixture)
    agent_dir = workspace / "agent"

    try:
        # Setup mocks if needed
        if mock_scripts:
            setup_mocks(workspace, mock_scripts)

        # Snapshot files before running
        before = snapshot_files(agent_dir)

        # Run CLI
        if verbose:
            print(f"Running: {cli} -p ...", file=sys.stderr)

        response_text, exit_code = run_cli(cli, prompt, cwd=agent_dir)

        if verbose:
            print(f"Exit code: {exit_code}", file=sys.stderr)
            print(f"Response: {response_text[:200]}...", file=sys.stderr)

        # Find changed files
        changed_files = find_new_or_modified_files(agent_dir, before)

        if verbose:
            print(f"Changed files: {[str(f.relative_to(agent_dir)) for f in changed_files]}", file=sys.stderr)

        # Run checks
        check_results = run_checks(workspace, changed_files, response_text, exit_code, checks)

        passed = sum(1 for r in check_results if r["passed"])
        total = len(check_results)

        if verbose:
            for r in check_results:
                status = "PASS" if r["passed"] else "FAIL"
                print(f"  [{status}] {r['check']}: {r['evidence']}", file=sys.stderr)
            print(f"Result: {passed}/{total} checks passed", file=sys.stderr)

        return {
            "eval_id": eval_id,
            "prompt": prompt,
            "fixture": fixture,
            "response_text": response_text[:1000],
            "exit_code": exit_code,
            "changed_files": [str(f.relative_to(agent_dir)) for f in changed_files],
            "checks": check_results,
            "summary": {"passed": passed, "failed": total - passed, "total": total},
        }
    finally:
        shutil.rmtree(workspace, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser(description="Skill result testing harness")
    parser.add_argument("--skill", required=True, help="Skill name to test")
    parser.add_argument("--eval-id", type=int, default=None, help="Run specific eval by ID")
    parser.add_argument("--cli", default="claude", help="CLI binary: 'claude' or 'copilot' (default: claude)")
    parser.add_argument("--verbose", action="store_true", help="Print progress to stderr")
    parser.add_argument("--output", default=None, help="Output results to file (default: stdout)")
    args = parser.parse_args()

    evals_data = load_evals(args.skill)
    evals_to_run = evals_data["evals"]

    if args.eval_id is not None:
        evals_to_run = [e for e in evals_to_run if e["id"] == args.eval_id]
        if not evals_to_run:
            print(f"Error: Eval ID {args.eval_id} not found", file=sys.stderr)
            sys.exit(1)

    if args.verbose:
        print(f"Running {len(evals_to_run)} eval(s) for skill '{args.skill}' with {args.cli}", file=sys.stderr)

    results = []
    for eval_item in evals_to_run:
        result = run_eval(eval_item, args.cli, args.verbose)
        results.append(result)

    output = {
        "skill_name": evals_data["skill_name"],
        "cli": args.cli,
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
    else:
        print(output_json)


if __name__ == "__main__":
    main()
