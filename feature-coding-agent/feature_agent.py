#!/usr/bin/env python3
"""
Feature Coding Agent
====================

A minimal harness for running an autonomous coding agent on existing repositories
to implement small tasks and features using the Claude Agent SDK.

Example Usage:
    python feature_agent.py --repo-dir /path/to/repo --task "Add dark mode toggle"
    python feature_agent.py --repo-dir /path/to/repo --task-file task.md
    python feature_agent.py --repo-dir /path/to/repo --task "Fix login bug" --max-iterations 3
"""

import argparse
import asyncio
import os
from pathlib import Path

from agent import run_feature_agent


# Configuration
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"


def parse_args() -> argparse.Namespace:
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="Feature Coding Agent - Work on existing repositories",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Implement a feature with inline task description
  python feature_agent.py --repo-dir ./my-project --task "Add a dark mode toggle to settings"

  # Use a task file for complex descriptions
  python feature_agent.py --repo-dir ./my-project --task-file task.md

  # Limit iterations for testing
  python feature_agent.py --repo-dir ./my-project --task "Fix the login bug" --max-iterations 3

  # Continue a previous task (just specify repo-dir)
  python feature_agent.py --repo-dir ./my-project

  # Use a specific model
  python feature_agent.py --repo-dir ./my-project --task "Refactor auth" --model claude-sonnet-4-5-20250929

Environment Variables:
  ANTHROPIC_API_KEY    Your Anthropic API key (required)
        """,
    )

    parser.add_argument(
        "--repo-dir",
        type=Path,
        required=True,
        help="Path to the existing repository to work on",
    )

    parser.add_argument(
        "--task",
        type=str,
        default=None,
        help="Task description (inline). Use --task-file for longer descriptions.",
    )

    parser.add_argument(
        "--task-file",
        type=Path,
        default=None,
        help="Path to a file containing the task description",
    )

    parser.add_argument(
        "--max-iterations",
        type=int,
        default=None,
        help="Maximum number of agent iterations (default: unlimited)",
    )

    parser.add_argument(
        "--model",
        type=str,
        default=DEFAULT_MODEL,
        help=f"Claude model to use (default: {DEFAULT_MODEL})",
    )

    return parser.parse_args()


def validate_repo(repo_dir: Path) -> None:
    """Validate that the repository exists and is a git repo."""
    if not repo_dir.exists():
        raise ValueError(f"Repository directory does not exist: {repo_dir}")
    
    if not repo_dir.is_dir():
        raise ValueError(f"Not a directory: {repo_dir}")
    
    git_dir = repo_dir / ".git"
    if not git_dir.exists():
        print(f"Warning: {repo_dir} is not a git repository")
        print("The agent works best with git for tracking changes")
        print()


def get_task(args: argparse.Namespace, repo_dir: Path) -> str:
    """Get the task description from args or existing task file."""
    # Check for inline task
    if args.task:
        return args.task
    
    # Check for task file
    if args.task_file:
        if not args.task_file.exists():
            raise ValueError(f"Task file does not exist: {args.task_file}")
        return args.task_file.read_text()
    
    # Check for existing task in repo
    existing_task_file = repo_dir / ".feature-agent" / "task.md"
    if existing_task_file.exists():
        print("Continuing existing task from .feature-agent/task.md")
        return existing_task_file.read_text()
    
    raise ValueError(
        "No task specified. Use --task or --task-file, "
        "or continue an existing task by running in a repo with .feature-agent/task.md"
    )


def main() -> None:
    """Main entry point."""
    args = parse_args()

    # Check for API key
    if not os.environ.get("ANTHROPIC_API_KEY"):
        print("Error: ANTHROPIC_API_KEY environment variable not set")
        print("\nGet your API key from: https://console.anthropic.com/")
        print("\nThen set it:")
        print("  export ANTHROPIC_API_KEY='your-api-key-here'")
        return

    # Validate repository
    repo_dir = args.repo_dir.resolve()
    try:
        validate_repo(repo_dir)
    except ValueError as e:
        print(f"Error: {e}")
        return

    # Get task description
    try:
        task = get_task(args, repo_dir)
    except ValueError as e:
        print(f"Error: {e}")
        return

    # Run the agent
    try:
        asyncio.run(
            run_feature_agent(
                repo_dir=repo_dir,
                task=task,
                model=args.model,
                max_iterations=args.max_iterations,
            )
        )
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        print("To resume, run the same command again (task is saved)")
    except Exception as e:
        print(f"\nFatal error: {e}")
        raise


if __name__ == "__main__":
    main()
