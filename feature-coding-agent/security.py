"""
Security Hooks for Feature Coding Agent
=======================================

Pre-tool-use hooks that validate bash commands for security.
Uses an allowlist approach - only explicitly permitted commands can run.
"""

import os
import shlex


# Allowed commands for development tasks on existing repositories
ALLOWED_COMMANDS = {
    # File inspection
    "ls",
    "cat",
    "head",
    "tail",
    "wc",
    "grep",
    "find",
    "tree",
    # File operations
    "cp",
    "mv",
    "mkdir",
    "chmod",
    "touch",
    # Directory
    "pwd",
    "cd",
    # Node.js development
    "npm",
    "npx",
    "pnpm",
    "pnpx",
    "yarn",
    "node",
    "bun",
    # Python development
    "python",
    "python3",
    "pip",
    "pip3",
    "poetry",
    "uv",
    "uvx",
    # Version control
    "git",
    # Build tools
    "make",
    "cargo",
    "go",
    "dotnet",
    # Process management
    "ps",
    "lsof",
    "sleep",
    "pkill",
    "kill",
    # Testing
    "pytest",
    "jest",
    "vitest",
    "mocha",
    # Utilities
    "echo",
    "which",
    "env",
    "export",
    "source",
    "curl",
    "wget",
}

# Commands that need additional validation
COMMANDS_NEEDING_EXTRA_VALIDATION = {"pkill", "kill", "chmod"}


def split_command_segments(command_string: str) -> list[str]:
    """
    Split a compound command into individual command segments.
    Handles command chaining (&&, ||, ;) but not pipes.
    """
    import re

    segments = re.split(r"\s*(?:&&|\|\|)\s*", command_string)
    result = []
    for segment in segments:
        sub_segments = re.split(r'(?<!["\'])\s*;\s*(?!["\'])', segment)
        for sub in sub_segments:
            sub = sub.strip()
            if sub:
                result.append(sub)
    return result


def extract_commands(command_string: str) -> list[str]:
    """
    Extract command names from a shell command string.
    Handles pipes, command chaining, and subshells.
    """
    commands = []
    import re

    segments = re.split(r'(?<!["\'])\s*;\s*(?!["\'])', command_string)

    for segment in segments:
        segment = segment.strip()
        if not segment:
            continue

        try:
            tokens = shlex.split(segment)
        except ValueError:
            return []

        if not tokens:
            continue

        expect_command = True

        for token in tokens:
            if token in ("|", "||", "&&", "&"):
                expect_command = True
                continue

            if token in (
                "if", "then", "else", "elif", "fi", "for", "while",
                "until", "do", "done", "case", "esac", "in", "!", "{", "}",
            ):
                continue

            if token.startswith("-"):
                continue

            if "=" in token and not token.startswith("="):
                continue

            if expect_command:
                cmd = os.path.basename(token)
                commands.append(cmd)
                expect_command = False

    return commands


def validate_pkill_command(command_string: str) -> tuple[bool, str]:
    """Validate pkill commands - only allow killing dev-related processes."""
    allowed_process_names = {
        "node", "npm", "npx", "pnpm", "yarn", "vite", "next",
        "python", "python3", "pytest", "uvicorn", "gunicorn",
    }

    try:
        tokens = shlex.split(command_string)
    except ValueError:
        return False, "Could not parse pkill command"

    if not tokens:
        return False, "Empty pkill command"

    args = [t for t in tokens[1:] if not t.startswith("-")]

    if not args:
        return False, "pkill requires a process name"

    target = args[-1]
    if " " in target:
        target = target.split()[0]

    if target in allowed_process_names:
        return True, ""
    return False, f"pkill only allowed for dev processes: {allowed_process_names}"


def validate_chmod_command(command_string: str) -> tuple[bool, str]:
    """Validate chmod commands - only allow making files executable."""
    try:
        tokens = shlex.split(command_string)
    except ValueError:
        return False, "Could not parse chmod command"

    if not tokens or tokens[0] != "chmod":
        return False, "Not a chmod command"

    mode = None
    files = []

    for token in tokens[1:]:
        if token.startswith("-"):
            return False, "chmod flags are not allowed"
        elif mode is None:
            mode = token
        else:
            files.append(token)

    if mode is None:
        return False, "chmod requires a mode"

    if not files:
        return False, "chmod requires at least one file"

    import re
    if not re.match(r"^[ugoa]*\+x$", mode):
        return False, f"chmod only allowed with +x mode, got: {mode}"

    return True, ""


def validate_kill_command(command_string: str) -> tuple[bool, str]:
    """Validate kill commands - only allow with specific signals."""
    try:
        tokens = shlex.split(command_string)
    except ValueError:
        return False, "Could not parse kill command"

    if not tokens:
        return False, "Empty kill command"

    # Allow kill with TERM, INT, or HUP signals (graceful termination)
    allowed_signals = {"-TERM", "-INT", "-HUP", "-15", "-2", "-1", "-9"}
    
    for token in tokens[1:]:
        if token.startswith("-") and token not in allowed_signals:
            # Check if it's a PID (numeric)
            if not token.lstrip("-").isdigit():
                return False, f"kill signal {token} not allowed"

    return True, ""


def get_command_for_validation(cmd: str, segments: list[str]) -> str:
    """Find the specific command segment containing the given command."""
    for segment in segments:
        segment_commands = extract_commands(segment)
        if cmd in segment_commands:
            return segment
    return ""


async def bash_security_hook(input_data, tool_use_id=None, context=None):
    """
    Pre-tool-use hook that validates bash commands using an allowlist.
    """
    if input_data.get("tool_name") != "Bash":
        return {}

    command = input_data.get("tool_input", {}).get("command", "")
    if not command:
        return {}

    commands = extract_commands(command)

    if not commands:
        return {
            "decision": "block",
            "reason": f"Could not parse command for security validation: {command}",
        }

    segments = split_command_segments(command)

    for cmd in commands:
        if cmd not in ALLOWED_COMMANDS:
            return {
                "decision": "block",
                "reason": f"Command '{cmd}' is not in the allowed commands list",
            }

        if cmd in COMMANDS_NEEDING_EXTRA_VALIDATION:
            cmd_segment = get_command_for_validation(cmd, segments)
            if not cmd_segment:
                cmd_segment = command

            if cmd == "pkill":
                allowed, reason = validate_pkill_command(cmd_segment)
                if not allowed:
                    return {"decision": "block", "reason": reason}
            elif cmd == "kill":
                allowed, reason = validate_kill_command(cmd_segment)
                if not allowed:
                    return {"decision": "block", "reason": reason}
            elif cmd == "chmod":
                allowed, reason = validate_chmod_command(cmd_segment)
                if not allowed:
                    return {"decision": "block", "reason": reason}

    return {}
