#!/usr/bin/env python3
"""
chat-with-agent.py — Send a single utterance to a published Copilot Studio agent.

Usage:
    python tests/chat-with-agent.py "your message"
    python tests/chat-with-agent.py "follow-up" --conversation-id <id>
    python tests/chat-with-agent.py "hello" --agent "Agent 7"

Output (stdout): single JSON object with full activity payloads
Diagnostics (stderr): human-readable progress lines
Exit codes: 0 = success, 1 = error
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

import msal
from microsoft_agents.copilotstudio.client import (
    ConnectionSettings,
    CopilotClient,
    PowerPlatformCloud,
    AgentType,
)
from microsoft_agents.activity import ActivityTypes

SCRIPT_DIR = Path(__file__).parent
AGENTS_PATH = SCRIPT_DIR / "agents.json"
CACHE_PATH = SCRIPT_DIR / ".token_cache.json"
AUTH_SCOPE = "https://api.powerplatform.com/.default"


def load_agent(agent_name=None):
    if not AGENTS_PATH.exists():
        _die("tests/agents.json not found. Run /chat-with-agent to configure.")
    with open(AGENTS_PATH, "r", encoding="utf-8") as f:
        registry = json.load(f)
    if not registry:
        _die("tests/agents.json is empty. Run /chat-with-agent to configure.")

    if agent_name:
        agent = registry.get(agent_name)
        if not agent:
            available = ", ".join(registry.keys())
            _die(f"Agent '{agent_name}' not found in registry. Available: {available}")
    elif len(registry) == 1:
        agent_name = next(iter(registry))
        agent = registry[agent_name]
    else:
        available = ", ".join(registry.keys())
        _die(f"Multiple agents in registry. Use --agent to select one. Available: {available}")

    required = ["environmentId", "agentIdentifier", "tenantId", "clientId"]
    missing = [k for k in required if not agent.get(k) or "YOUR_" in str(agent.get(k, ""))]
    if missing:
        _die(f"Agent '{agent_name}' has missing or placeholder values: {', '.join(missing)}")

    _log(f"Using agent: {agent_name}")
    return agent


def get_access_token(tenant_id, client_id):
    cache = msal.SerializableTokenCache()
    if CACHE_PATH.exists():
        cache.deserialize(CACHE_PATH.read_text(encoding="utf-8"))

    app = msal.PublicClientApplication(
        client_id,
        authority=f"https://login.microsoftonline.com/{tenant_id}",
        token_cache=cache,
    )

    accounts = app.get_accounts()
    if accounts:
        result = app.acquire_token_silent([AUTH_SCOPE], account=accounts[0])
        if result and "access_token" in result:
            _log("Using cached token.")
            _save_cache(cache)
            return result["access_token"]

    flow = app.initiate_device_flow(scopes=[AUTH_SCOPE])
    if "message" not in flow:
        _die(f"Could not initiate device flow: {flow.get('error_description', flow)}")
    _log(flow["message"])
    result = app.acquire_token_by_device_flow(flow)

    if "access_token" not in result:
        _die(f"Authentication failed: {result.get('error_description', result)}")

    _save_cache(cache)
    return result["access_token"]


def _save_cache(cache):
    if cache.has_state_changed:
        CACHE_PATH.write_text(cache.serialize(), encoding="utf-8")


def _activity_to_dict(activity):
    """Convert an Activity to a JSON-serializable dict with full payload."""
    return activity.model_dump(mode="json", by_alias=True, exclude_none=True)


async def chat(utterance, conversation_id, cfg, token):
    settings = ConnectionSettings(
        environment_id=cfg["environmentId"],
        agent_identifier=cfg["agentIdentifier"],
        cloud=PowerPlatformCloud.PROD,
        copilot_agent_type=AgentType.PUBLISHED,
        custom_power_platform_cloud=None,
    )

    client = CopilotClient(settings, token)

    # Start a new conversation if no conversation_id provided
    if conversation_id is None:
        _log("Starting new conversation...")
        start_activities = []
        async for activity in client.start_conversation(emit_start_conversation_event=True):
            start_activities.append(_activity_to_dict(activity))
            if activity.conversation and activity.conversation.id:
                conversation_id = activity.conversation.id

        if not conversation_id:
            _die("Could not obtain conversation_id from start_conversation.")
        _log(f"Conversation started: {conversation_id}")
    else:
        start_activities = []
        _log(f"Reusing conversation: {conversation_id}")

    # Send the utterance and collect all response activities
    _log(f"Sending: {utterance}")
    response_activities = []
    async for activity in client.ask_question(utterance, conversation_id):
        response_activities.append(_activity_to_dict(activity))

    return {
        "status": "ok",
        "utterance": utterance,
        "conversation_id": conversation_id,
        "start_activities": start_activities,
        "activities": response_activities,
    }


def _log(msg):
    print(msg, file=sys.stderr, flush=True)


def _die(msg):
    print(json.dumps({"status": "error", "error": msg}), flush=True)
    sys.exit(1)


def main():
    parser = argparse.ArgumentParser(
        description="Send an utterance to a published Copilot Studio agent."
    )
    parser.add_argument("utterance", help="Message to send to the agent")
    parser.add_argument(
        "--conversation-id",
        default=None,
        help="Reuse an existing conversation (for multi-turn)",
    )
    parser.add_argument(
        "--agent",
        default=None,
        help="Agent name from tests/agents.json (required if multiple agents registered)",
    )
    args = parser.parse_args()

    cfg = load_agent(args.agent)

    _log("Authenticating...")
    token = get_access_token(cfg["tenantId"], cfg["clientId"])

    try:
        result = asyncio.run(chat(args.utterance, args.conversation_id, cfg, token))
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        _die(f"Unexpected error: {e}")


if __name__ == "__main__":
    main()
