"""
Claude SDK Client Configuration
===============================

Functions for creating and configuring the Claude Agent SDK client.
"""

import json
import os
from pathlib import Path

from claude_code_sdk import ClaudeCodeOptions, ClaudeSDKClient
from claude_code_sdk.types import HookMatcher

from security import bash_security_hook


# Built-in tools for code editing
BUILTIN_TOOLS = [
    "Read",
    "Write",
    "Edit",
    "Glob",
    "Grep",
    "Bash",
]


def create_client(repo_dir: Path, model: str) -> ClaudeSDKClient:
    """
    Create a Claude Agent SDK client for working on existing repositories.

    Args:
        repo_dir: Directory of the existing repository
        model: Claude model to use

    Returns:
        Configured ClaudeSDKClient

    Security layers:
    1. Sandbox - OS-level bash command isolation
    2. Permissions - File operations restricted to repo_dir only
    3. Security hooks - Bash commands validated against allowlist
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY environment variable not set.\n"
            "Get your API key from: https://console.anthropic.com/"
        )

    # Security settings - restrict to repository directory
    security_settings = {
        "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True},
        "permissions": {
            "defaultMode": "acceptEdits",
            "allow": [
                "Read(./**)",
                "Write(./**)",
                "Edit(./**)",
                "Glob(./**)",
                "Grep(./**)",
                "Bash(*)",
            ],
        },
    }

    # Write settings to agent directory
    agent_dir = repo_dir / ".feature-agent"
    agent_dir.mkdir(parents=True, exist_ok=True)
    
    settings_file = agent_dir / "claude_settings.json"
    with open(settings_file, "w") as f:
        json.dump(security_settings, f, indent=2)

    print(f"Security settings at {settings_file}")
    print("   - Sandbox enabled")
    print(f"   - Filesystem restricted to: {repo_dir.resolve()}")
    print("   - Bash commands restricted to allowlist")
    print()

    return ClaudeSDKClient(
        options=ClaudeCodeOptions(
            model=model,
            system_prompt=(
                "You are an expert developer working on an existing codebase. "
                "Your goal is to implement features, fix bugs, and improve code "
                "while respecting the project's existing patterns and conventions."
            ),
            allowed_tools=BUILTIN_TOOLS,
            hooks={
                "PreToolUse": [
                    HookMatcher(matcher="Bash", hooks=[bash_security_hook]),
                ],
            },
            max_turns=1000,
            cwd=str(repo_dir.resolve()),
            settings=str(settings_file.resolve()),
        )
    )
