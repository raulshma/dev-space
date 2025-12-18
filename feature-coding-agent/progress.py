"""
Progress Tracking Utilities
===========================

Functions for tracking and displaying progress of the feature coding agent.
"""

import json
from pathlib import Path
from typing import Optional


AGENT_DIR = ".feature-agent"


def get_agent_dir(repo_dir: Path) -> Path:
    """Get the agent working directory within the repository."""
    return repo_dir / AGENT_DIR


def ensure_agent_dir(repo_dir: Path) -> Path:
    """Ensure the agent working directory exists."""
    agent_dir = get_agent_dir(repo_dir)
    agent_dir.mkdir(parents=True, exist_ok=True)
    return agent_dir


def save_task(repo_dir: Path, task: str) -> None:
    """Save the task description to the agent directory."""
    agent_dir = ensure_agent_dir(repo_dir)
    task_file = agent_dir / "task.md"
    task_file.write_text(task)


def load_task(repo_dir: Path) -> Optional[str]:
    """Load the task description from the agent directory."""
    task_file = get_agent_dir(repo_dir) / "task.md"
    if task_file.exists():
        return task_file.read_text()
    return None


def get_progress(repo_dir: Path) -> dict:
    """
    Load progress from progress.json.
    
    Returns dict with:
        - status: "pending" | "in_progress" | "completed"
        - criteria: list of acceptance criteria
        - completed_criteria: list of completed criteria indices
        - sessions: number of sessions run
    """
    progress_file = get_agent_dir(repo_dir) / "progress.json"
    
    if not progress_file.exists():
        return {
            "status": "pending",
            "criteria": [],
            "completed_criteria": [],
            "sessions": 0,
        }
    
    try:
        with open(progress_file, "r") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return {
            "status": "pending",
            "criteria": [],
            "completed_criteria": [],
            "sessions": 0,
        }


def save_progress(repo_dir: Path, progress: dict) -> None:
    """Save progress to progress.json."""
    agent_dir = ensure_agent_dir(repo_dir)
    progress_file = agent_dir / "progress.json"
    
    with open(progress_file, "w") as f:
        json.dump(progress, f, indent=2)


def is_task_complete(repo_dir: Path) -> bool:
    """Check if the current task is marked as complete."""
    progress = get_progress(repo_dir)
    return progress.get("status") == "completed"


def print_session_header(session_num: int) -> None:
    """Print a formatted header for the session."""
    print("\n" + "=" * 70)
    print(f"  SESSION {session_num}: FEATURE CODING AGENT")
    print("=" * 70)
    print()


def print_progress_summary(repo_dir: Path) -> None:
    """Print a summary of current progress."""
    progress = get_progress(repo_dir)
    
    status = progress.get("status", "pending")
    criteria = progress.get("criteria", [])
    completed = progress.get("completed_criteria", [])
    sessions = progress.get("sessions", 0)
    
    print(f"\nStatus: {status}")
    print(f"Sessions: {sessions}")
    
    if criteria:
        completed_count = len(completed)
        total_count = len(criteria)
        percentage = (completed_count / total_count) * 100 if total_count > 0 else 0
        print(f"Criteria: {completed_count}/{total_count} ({percentage:.0f}%)")
    else:
        print("Criteria: Not yet defined")


def print_task_summary(repo_dir: Path) -> None:
    """Print the current task summary."""
    task = load_task(repo_dir)
    if task:
        # Show first 200 chars of task
        preview = task[:200] + "..." if len(task) > 200 else task
        print(f"\nTask: {preview}")
    else:
        print("\nNo task defined")
