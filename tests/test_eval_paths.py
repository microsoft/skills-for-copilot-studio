import contextlib
import importlib.util
import io
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch


SPEC = importlib.util.spec_from_file_location(
    "evaluate", Path(__file__).resolve().parents[1] / "evals" / "evaluate.py"
)
evaluate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(evaluate)


class EvalPathTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="eval-path-test-")
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.fixtures = self.root / "fixtures"
        self.mocks = self.root / "mocks"
        self.workspace = self.root / "workspace"
        for directory in (self.fixtures, self.mocks, self.workspace):
            directory.mkdir()
        for attribute, value in (("FIXTURES_DIR", self.fixtures), ("MOCKS_DIR", self.mocks)):
            patcher = patch.object(evaluate, attribute, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def test_nested_and_empty_fixtures_remain_supported(self):
        fixture = self.fixtures / "nested" / "agent"
        fixture.mkdir(parents=True)
        (fixture / "agent.yaml").write_text("kind: GptComponent")
        (fixture / "empty").mkdir()
        workspace = evaluate.setup_workspace("nested/agent")
        self.addCleanup(shutil.rmtree, workspace)
        self.assertEqual((workspace / "agent" / "agent.yaml").read_text(), "kind: GptComponent")
        self.assertTrue((workspace / "agent" / "empty").is_dir())
        empty_workspace = evaluate.setup_workspace("nested/agent/empty")
        self.addCleanup(shutil.rmtree, empty_workspace)
        self.assertEqual(list((empty_workspace / "agent").iterdir()), [])

    def test_invalid_names_are_rejected_for_both_fixtures_and_mocks(self):
        for name in ("", "..", "../outside", "nested/../../outside", str(self.root),
                     r"C:\outside", "C:outside", r"\\server\share", r"nested\file",
                     "bad\0name", None, 12):
            with self.subTest(name=name):
                with self.assertRaises(ValueError):
                    evaluate.setup_workspace(name)
                with self.assertRaises(ValueError):
                    evaluate.setup_mocks(self.workspace, [name])

    def test_nested_mocks_copy_and_missing_in_base_mock_warns(self):
        (self.mocks / "nested").mkdir()
        (self.mocks / "nested" / "mock.js").write_text("module.exports = {};")
        evaluate.setup_mocks(self.workspace, ["nested/mock.js"])
        self.assertEqual((self.workspace / "scripts/nested/mock.js").read_text(), "module.exports = {};")
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            evaluate.setup_mocks(self.workspace, ["missing.js"])
        self.assertIn("Warning: Mock not found:", stderr.getvalue())
        evaluate.setup_mocks(self.workspace, [])
        with self.assertRaises(ValueError):
            evaluate.setup_mocks(self.workspace, "nested/mock.js")

    def test_fixture_root_and_nested_symlink_escapes_are_rejected(self):
        outside = self.root / "outside"
        outside.mkdir()
        (outside / "secret").write_text("do not copy")
        (self.fixtures / "escape").symlink_to(outside, target_is_directory=True)
        with self.assertRaises(ValueError):
            evaluate.setup_workspace("escape")
        fixture = self.fixtures / "agent"
        fixture.mkdir()
        for target in (outside, outside / "secret"):
            link = fixture / "escape"
            link.symlink_to(target, target_is_directory=target.is_dir())
            with self.assertRaises(ValueError):
                evaluate.setup_workspace("agent")
            link.unlink()

    def test_internal_fixture_links_are_supported_but_cycles_are_rejected(self):
        fixture = self.fixtures / "agent"
        fixture.mkdir()
        (fixture / "real").mkdir()
        (fixture / "real" / "data").write_text("fixture")
        (fixture / "alias").symlink_to("real", target_is_directory=True)
        workspace = evaluate.setup_workspace("agent")
        self.addCleanup(shutil.rmtree, workspace)
        self.assertEqual((workspace / "agent" / "alias" / "data").read_text(), "fixture")
        (fixture / "real" / "loop").symlink_to(fixture, target_is_directory=True)
        with self.assertRaises(ValueError):
            evaluate.setup_workspace("agent")

    def test_mock_source_symlinks_cannot_read_outside_base(self):
        outside = self.root / "outside.js"
        outside.write_text("do not copy")
        (self.mocks / "escape.js").symlink_to(outside)
        with self.assertRaises(ValueError):
            evaluate.setup_mocks(self.workspace, ["escape.js"])
        (self.mocks / "parent").symlink_to(self.root, target_is_directory=True)
        with self.assertRaises(ValueError):
            evaluate.setup_mocks(self.workspace, ["parent/outside.js"])
        self.assertFalse((self.workspace / "scripts/escape.js").exists())

    def test_mock_destination_file_and_parent_symlinks_cannot_escape(self):
        (self.mocks / "mock.js").write_text("mock")
        (self.mocks / "nested").mkdir()
        (self.mocks / "nested" / "mock.js").write_text("mock")
        outside = self.root / "outside"
        outside.mkdir()
        protected = outside / "protected.js"
        protected.write_text("unchanged")
        scripts = self.workspace / "scripts"
        scripts.mkdir()
        (scripts / "mock.js").symlink_to(protected)
        (scripts / "nested").symlink_to(outside, target_is_directory=True)
        for name in ("mock.js", "nested/mock.js"):
            with self.assertRaises(ValueError):
                evaluate.setup_mocks(self.workspace, [name])
        self.assertEqual(protected.read_text(), "unchanged")
        self.assertFalse((outside / "mock.js").exists())

    def test_scripts_root_symlink_is_rejected(self):
        (self.mocks / "mock.js").write_text("mock")
        outside = self.root / "outside"
        outside.mkdir()
        (self.workspace / "scripts").symlink_to(outside, target_is_directory=True)
        with self.assertRaises(ValueError):
            evaluate.setup_mocks(self.workspace, ["mock.js"])
        self.assertEqual(list(outside.iterdir()), [])

    def test_scenario_loading_uses_the_same_containment_boundary(self):
        with patch.object(evaluate, "EVALS_SCENARIOS_DIR", self.fixtures):
            (self.root / "outside.json").write_text("{}")
            with self.assertRaises(ValueError):
                evaluate.load_evals("../outside")
            (self.fixtures / "valid.json").write_text('{"evals": []}')
            self.assertEqual(evaluate.load_evals("valid"), {"evals": []})

    def test_shipped_fixture_trees_satisfy_containment(self):
        fixtures = evaluate.REPO_ROOT / "evals" / "fixtures"
        for fixture in fixtures.iterdir():
            if fixture.is_dir():
                with self.subTest(fixture=fixture.name):
                    evaluate.validate_fixture_tree(fixture, fixture.resolve())


if __name__ == "__main__":
    unittest.main()
