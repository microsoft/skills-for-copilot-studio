#!/usr/bin/env python3
"""
Copilot Studio YAML Schema Lookup Tool

This script provides utilities to query the Copilot Studio YAML schema
without loading the entire file into memory. It supports:
- Looking up specific definitions
- Searching for definitions by keyword
- Resolving $ref chains to get complete definitions
- Listing all available definitions
- Validating YAML files against schema and best practices

Usage:
    python schema-lookup.py lookup <definition-name>
    python schema-lookup.py search <keyword>
    python schema-lookup.py list
    python schema-lookup.py resolve <definition-name>
    python schema-lookup.py kinds
    python schema-lookup.py summary <definition-name>
    python schema-lookup.py validate <path-to-yaml-file>
"""

import json
import sys
import os
import re
from pathlib import Path
from typing import Dict, Any, Optional, List, Set


def get_schema_path() -> Path:
    """Get the path to the schema file."""
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    schema_path = project_root / "reference" / "bot.schema.yaml-authoring.json"
    
    if not schema_path.exists():
        print(f"Error: Schema file not found at {schema_path}")
        print("Please place 'bot.schema.yaml-authoring.json' in the 'reference/' directory.")
        sys.exit(1)
    
    return schema_path


def load_schema() -> Dict[str, Any]:
    """Load the schema file."""
    schema_path = get_schema_path()
    with open(schema_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def get_definitions(schema: Dict[str, Any]) -> Dict[str, Any]:
    """Extract definitions from schema."""
    return schema.get("definitions", {})


def lookup_definition(name: str, definitions: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Look up a specific definition by name (case-insensitive)."""
    # Try exact match first
    if name in definitions:
        return definitions[name]
    
    # Try case-insensitive match
    name_lower = name.lower()
    for key, value in definitions.items():
        if key.lower() == name_lower:
            return value
    
    return None


def search_definitions(keyword: str, definitions: Dict[str, Any]) -> List[str]:
    """Search for definitions containing the keyword (case-insensitive)."""
    keyword_lower = keyword.lower()
    matches = []
    
    for key in definitions.keys():
        if keyword_lower in key.lower():
            matches.append(key)
    
    return sorted(matches)


def resolve_ref(ref: str, definitions: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Resolve a $ref to its definition."""
    if ref.startswith("#/definitions/"):
        def_name = ref[len("#/definitions/"):]
        return definitions.get(def_name)
    return None


def resolve_definition(name: str, definitions: Dict[str, Any], 
                       visited: Optional[Set[str]] = None, 
                       depth: int = 0, 
                       max_depth: int = 5) -> Dict[str, Any]:
    """
    Recursively resolve a definition, following $ref chains.
    Returns a fully resolved definition with all references expanded.
    """
    if visited is None:
        visited = set()
    
    if depth > max_depth:
        return {"_note": f"Max depth ({max_depth}) reached, stopping recursion"}
    
    if name in visited:
        return {"_ref": name, "_note": "Circular reference detected"}
    
    visited.add(name)
    
    definition = lookup_definition(name, definitions)
    if definition is None:
        return {"_error": f"Definition '{name}' not found"}
    
    return _resolve_object(definition, definitions, visited.copy(), depth, max_depth)


def _resolve_object(obj: Any, definitions: Dict[str, Any], 
                    visited: Set[str], depth: int, max_depth: int) -> Any:
    """Recursively resolve an object, expanding $ref references."""
    if not isinstance(obj, dict):
        if isinstance(obj, list):
            return [_resolve_object(item, definitions, visited, depth, max_depth) for item in obj]
        return obj
    
    # Handle $ref
    if "$ref" in obj and len(obj) == 1:
        ref = obj["$ref"]
        if ref.startswith("#/definitions/"):
            def_name = ref[len("#/definitions/"):]
            if def_name in visited:
                return {"_ref": def_name, "_note": "Circular reference"}
            return resolve_definition(def_name, definitions, visited, depth + 1, max_depth)
        return obj
    
    # Recursively resolve all properties
    resolved = {}
    for key, value in obj.items():
        if key == "$ref":
            resolved[key] = value
        else:
            resolved[key] = _resolve_object(value, definitions, visited, depth, max_depth)
    
    return resolved


def find_kind_values(definitions: Dict[str, Any]) -> List[str]:
    """Find all 'kind' discriminator values used in the schema."""
    kinds = set()
    
    def extract_kinds(obj: Any):
        if isinstance(obj, dict):
            # Check for kind enum
            if "kind" in obj:
                kind_def = obj["kind"]
                if isinstance(kind_def, dict):
                    if "const" in kind_def:
                        kinds.add(kind_def["const"])
                    elif "enum" in kind_def:
                        kinds.update(kind_def["enum"])
            
            # Check for properties.kind
            if "properties" in obj and isinstance(obj["properties"], dict):
                if "kind" in obj["properties"]:
                    kind_prop = obj["properties"]["kind"]
                    if isinstance(kind_prop, dict):
                        if "const" in kind_prop:
                            kinds.add(kind_prop["const"])
                        elif "enum" in kind_prop:
                            kinds.update(kind_prop["enum"])
            
            # Recurse into nested objects
            for value in obj.values():
                extract_kinds(value)
        elif isinstance(obj, list):
            for item in obj:
                extract_kinds(item)
    
    for definition in definitions.values():
        extract_kinds(definition)
    
    return sorted(kinds)


def format_definition(name: str, definition: Dict[str, Any], compact: bool = False) -> str:
    """Format a definition for display."""
    if compact:
        # Just show the structure overview
        output = [f"Definition: {name}"]
        
        if "description" in definition:
            output.append(f"Description: {definition['description']}")
        
        if "properties" in definition:
            output.append("Properties:")
            for prop_name, prop_def in definition["properties"].items():
                prop_type = prop_def.get("type", "")
                if "$ref" in prop_def:
                    prop_type = prop_def["$ref"].split("/")[-1]
                output.append(f"  - {prop_name}: {prop_type}")
        
        if "required" in definition:
            output.append(f"Required: {', '.join(definition['required'])}")
        
        if "oneOf" in definition:
            output.append("OneOf:")
            for item in definition["oneOf"]:
                if "$ref" in item:
                    output.append(f"  - {item['$ref'].split('/')[-1]}")
        
        if "allOf" in definition:
            output.append("AllOf:")
            for item in definition["allOf"]:
                if "$ref" in item:
                    output.append(f"  - {item['$ref'].split('/')[-1]}")
        
        return "\n".join(output)
    else:
        # Full JSON output
        return json.dumps({name: definition}, indent=2)


def validate_yaml_file(filepath: str, definitions: Dict[str, Any]) -> None:
    """Validate a Copilot Studio YAML file against schema and best practices."""
    try:
        import yaml
    except ImportError:
        print("[FAIL] PyYAML is not installed. Run: pip install pyyaml>=6.0")
        sys.exit(1)

    path = Path(filepath)
    if not path.exists():
        print(f"[FAIL] File not found: {filepath}")
        sys.exit(1)

    passes = 0
    warnings = 0
    failures = 0

    # 1. YAML parsing
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        if data is None:
            print(f"[FAIL] File is empty or not valid YAML")
            sys.exit(1)
        print(f"[PASS] YAML parsing successful")
        passes += 1
    except yaml.YAMLError as e:
        print(f"[FAIL] YAML parsing error: {e}")
        sys.exit(1)

    # 2. Kind detection
    kind = data.get("kind")
    if kind:
        print(f"[PASS] Kind detected: {kind}")
        passes += 1
        known_kinds = find_kind_values(definitions)
        if kind in known_kinds:
            print(f"[PASS] Kind '{kind}' exists in schema")
            passes += 1
        else:
            print(f"[WARN] Kind '{kind}' not found in schema kind values")
            warnings += 1
    else:
        print(f"[FAIL] No 'kind' property found at root level")
        failures += 1

    # 3. Required properties check based on kind
    if kind == "AdaptiveDialog":
        if "beginDialog" in data:
            print(f"[PASS] Required 'beginDialog' property present")
            passes += 1
            bd = data["beginDialog"]
            if isinstance(bd, dict):
                if "kind" in bd:
                    print(f"[PASS] beginDialog.kind: {bd['kind']}")
                    passes += 1
                else:
                    print(f"[FAIL] beginDialog missing 'kind' property")
                    failures += 1
                if "id" in bd:
                    print(f"[PASS] beginDialog.id: {bd['id']}")
                    passes += 1
                else:
                    print(f"[FAIL] beginDialog missing 'id' property")
                    failures += 1
        else:
            print(f"[FAIL] AdaptiveDialog missing required 'beginDialog' property")
            failures += 1
    elif kind == "GptComponentMetadata":
        for prop in ["displayName", "instructions"]:
            if prop in data:
                print(f"[PASS] Required '{prop}' property present")
                passes += 1
            else:
                print(f"[WARN] Missing '{prop}' property (recommended)")
                warnings += 1
    elif kind == "KnowledgeSourceConfiguration":
        if "source" in data:
            print(f"[PASS] Required 'source' property present")
            passes += 1
        else:
            print(f"[FAIL] Missing required 'source' property")
            failures += 1

    # 4. Duplicate ID detection
    ids_found = []
    def collect_ids(obj):
        if isinstance(obj, dict):
            if "id" in obj and isinstance(obj["id"], str):
                ids_found.append(obj["id"])
            for v in obj.values():
                collect_ids(v)
        elif isinstance(obj, list):
            for item in obj:
                collect_ids(item)

    collect_ids(data)
    seen = set()
    duplicates = set()
    for node_id in ids_found:
        if node_id in seen:
            duplicates.add(node_id)
        seen.add(node_id)

    if duplicates:
        for dup in sorted(duplicates):
            print(f"[FAIL] Duplicate ID found: {dup}")
            failures += 1
    elif ids_found:
        print(f"[PASS] All {len(ids_found)} node IDs are unique")
        passes += 1

    # 5. _REPLACE placeholder check
    yaml_text = path.read_text(encoding='utf-8')
    replace_count = yaml_text.count("_REPLACE")
    if replace_count > 0:
        print(f"[FAIL] Found {replace_count} unresolved '_REPLACE' placeholder(s)")
        failures += 1
    else:
        print(f"[PASS] No '_REPLACE' placeholders remaining")
        passes += 1

    # 6. Power Fx = prefix check
    def check_powerfx(obj, path_str=""):
        pfx_issues = []
        if isinstance(obj, dict):
            for key, val in obj.items():
                if key in ("condition", "value") and isinstance(val, str):
                    # These fields often need = prefix for expressions
                    # But not all values are expressions (plain strings are ok)
                    pass
                if key == "condition" and isinstance(val, str) and not val.startswith("="):
                    pfx_issues.append(f"  condition at {path_str}.{key}: '{val}' (may need '=' prefix)")
                for issue in check_powerfx(val, f"{path_str}.{key}"):
                    pfx_issues.append(issue)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                for issue in check_powerfx(item, f"{path_str}[{i}]"):
                    pfx_issues.append(issue)
        return pfx_issues

    pfx_issues = check_powerfx(data)
    if pfx_issues:
        for issue in pfx_issues:
            print(f"[WARN] Possible missing '=' prefix: {issue}")
            warnings += 1
    else:
        print(f"[PASS] No Power Fx prefix issues detected")
        passes += 1

    # 7. Variable scope check
    def check_variables(obj):
        var_issues = []
        if isinstance(obj, dict):
            if "variable" in obj and isinstance(obj["variable"], str):
                var = obj["variable"]
                # Strip init: prefix
                clean_var = var.replace("init:", "")
                if not (clean_var.startswith("Topic.") or clean_var.startswith("System.") or
                        clean_var.startswith("Global.") or clean_var.startswith("User.")):
                    var_issues.append(f"Variable '{var}' missing scope prefix (Topic., System., Global., User.)")
            for v in obj.values():
                var_issues.extend(check_variables(v))
        elif isinstance(obj, list):
            for item in obj:
                var_issues.extend(check_variables(item))
        return var_issues

    var_issues = check_variables(data)
    if var_issues:
        for issue in var_issues:
            print(f"[WARN] {issue}")
            warnings += 1
    else:
        print(f"[PASS] Variable scopes look correct")
        passes += 1

    # 8. inputType/outputType consistency
    if "inputs" in data and "inputType" in data:
        input_names = set()
        for inp in data.get("inputs", []):
            if isinstance(inp, dict) and "propertyName" in inp:
                input_names.add(inp["propertyName"])
        input_type_props = set(data.get("inputType", {}).get("properties", {}).keys())
        if input_names == input_type_props:
            print(f"[PASS] inputs and inputType.properties are consistent")
            passes += 1
        else:
            missing_in_type = input_names - input_type_props
            missing_in_inputs = input_type_props - input_names
            if missing_in_type:
                print(f"[WARN] inputs defined but missing from inputType: {missing_in_type}")
                warnings += 1
            if missing_in_inputs:
                print(f"[WARN] inputType properties missing from inputs: {missing_in_inputs}")
                warnings += 1

    # Summary
    print(f"\nSummary: {passes} passed, {warnings} warnings, {failures} failures")
    if failures > 0:
        sys.exit(1)


def print_help():
    """Print usage help."""
    print(__doc__)


def main():
    if len(sys.argv) < 2:
        print_help()
        sys.exit(1)
    
    command = sys.argv[1].lower()
    
    if command == "help" or command == "--help" or command == "-h":
        print_help()
        sys.exit(0)
    
    # Load schema
    schema = load_schema()
    definitions = get_definitions(schema)
    
    if command == "lookup":
        if len(sys.argv) < 3:
            print("Error: Please provide a definition name")
            print("Usage: python schema-lookup.py lookup <definition-name>")
            sys.exit(1)
        
        name = sys.argv[2]
        definition = lookup_definition(name, definitions)
        
        if definition:
            print(format_definition(name, definition, compact=False))
        else:
            # Try to find similar names
            similar = search_definitions(name, definitions)[:10]
            print(f"Definition '{name}' not found.")
            if similar:
                print(f"Did you mean one of these?")
                for s in similar:
                    print(f"  - {s}")
    
    elif command == "search":
        if len(sys.argv) < 3:
            print("Error: Please provide a search keyword")
            print("Usage: python schema-lookup.py search <keyword>")
            sys.exit(1)
        
        keyword = sys.argv[2]
        matches = search_definitions(keyword, definitions)
        
        if matches:
            print(f"Found {len(matches)} definitions matching '{keyword}':")
            for match in matches:
                print(f"  - {match}")
        else:
            print(f"No definitions found matching '{keyword}'")
    
    elif command == "list":
        all_defs = sorted(definitions.keys())
        print(f"Available definitions ({len(all_defs)} total):")
        for name in all_defs:
            print(f"  - {name}")
    
    elif command == "resolve":
        if len(sys.argv) < 3:
            print("Error: Please provide a definition name")
            print("Usage: python schema-lookup.py resolve <definition-name>")
            sys.exit(1)
        
        name = sys.argv[2]
        resolved = resolve_definition(name, definitions)
        print(json.dumps({name: resolved}, indent=2))
    
    elif command == "kinds":
        kinds = find_kind_values(definitions)
        print(f"Available 'kind' values ({len(kinds)} total):")
        for kind in kinds:
            print(f"  - {kind}")
    
    elif command == "summary":
        if len(sys.argv) < 3:
            print("Error: Please provide a definition name")
            print("Usage: python schema-lookup.py summary <definition-name>")
            sys.exit(1)

        name = sys.argv[2]
        definition = lookup_definition(name, definitions)

        if definition:
            print(format_definition(name, definition, compact=True))
        else:
            print(f"Definition '{name}' not found.")

    elif command == "validate":
        if len(sys.argv) < 3:
            print("Error: Please provide a YAML file path")
            print("Usage: python schema-lookup.py validate <path-to-yaml-file>")
            sys.exit(1)

        filepath = sys.argv[2]
        validate_yaml_file(filepath, definitions)

    else:
        print(f"Unknown command: {command}")
        print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
