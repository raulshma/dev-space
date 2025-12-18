"""
Agent Session Logic
===================

Core agent interaction functions for running feature coding sessions.
"""

import asyncio
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from claude_code_sdk import ClaudeSDKClient

from client import create_client
from progress import (
    print_session_header,
    print_progress_summary,
    print_task_summary,
    save_task,
    load_task,
    get_progress,
    save_progress,
    is_task_complete,
)
from prompts import get_feature_prompt


# Configuration
AUTO_CONTINUE_DELAY_SECONDS = 3
DEFAULT_RATE_LIMIT_WAIT_MINUTES = 30
RATE_LIMIT_BUFFER_SECONDS = 60
RATE_LIMIT_RESUME_INTERVAL_SECONDS = 30 * 60


def parse_rate_limit_reset_time(error_message: str) -> Optional[datetime]:
    """Parse the reset time from a 429 rate limit error message."""
    pattern = r"reset at (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})"
    match = re.search(pattern, error_message)
    
    if match:
        try:
            return datetime.strptime(match.group(1), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None
    return None


async def countdown_timer(
    seconds: int, message: str = "Time until retry", update_interval: int = 30
) -> None:
    """Display a countdown timer."""
    while seconds > 0:
        hours, remainder = divmod(seconds, 3600)
        minutes, secs = divmod(remainder, 60)
        
        if hours > 0:
            time_str = f"{hours:02d}:{minutes:02d}:{secs:02d}"
        else:
            time_str = f"{minutes:02d}:{secs:02d}"
        
        sys.stdout.write(f"\r{message}: {time_str}   ")
        sys.stdout.flush()
        
        sleep_time = min(update_interval, seconds)
        await asyncio.sleep(sleep_time)
        seconds -= sleep_time
    
    sys.stdout.write("\r" + " " * 60 + "\r")
    sys.stdout.flush()


async def handle_rate_limit(error_message: str) -> None:
    """Handle a 429 rate limit error by waiting until the reset time."""
    print("\n" + "=" * 70)
    print("  RATE LIMIT REACHED (429)")
    print("=" * 70)
    
    reset_time = parse_rate_limit_reset_time(error_message)
    
    if reset_time:
        now = datetime.now()
        wait_seconds_until_reset = max(0, int((reset_time - now).total_seconds()))
        wait_seconds = wait_seconds_until_reset + RATE_LIMIT_BUFFER_SECONDS
        
        if wait_seconds > 0:
            retry_time = reset_time + timedelta(seconds=RATE_LIMIT_BUFFER_SECONDS)
            print(f"\nReset time: {reset_time.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"Will retry at: {retry_time.strftime('%Y-%m-%d %H:%M:%S')}")
            
            if wait_seconds > RATE_LIMIT_RESUME_INTERVAL_SECONDS:
                next_wait = min(wait_seconds, RATE_LIMIT_RESUME_INTERVAL_SECONDS)
                await countdown_timer(next_wait, "Next retry window")
            else:
                await countdown_timer(wait_seconds, "Time until retry")
    else:
        print(f"\nWaiting {DEFAULT_RATE_LIMIT_WAIT_MINUTES} minutes...")
        await countdown_timer(DEFAULT_RATE_LIMIT_WAIT_MINUTES * 60, "Time until retry")
    
    print("\n" + "=" * 70 + "\n")


class RateLimitDetector:
    """Context manager to detect 429 errors printed to stdout/stderr."""
    
    API_ERROR_PATTERN = re.compile(
        r'"type"\s*:\s*"error".*"message"\s*:\s*"[^"]*reset at \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}'
    )
    
    def __init__(self):
        self.rate_limit_detected = False
        self.error_message = ""
        self._original_stdout_write = None
        self._original_stderr_write = None
        self._buffer = ""
    
    def _check_for_rate_limit(self, text: str) -> None:
        self._buffer += text
        if self.API_ERROR_PATTERN.search(self._buffer):
            self.rate_limit_detected = True
            self.error_message = self._buffer
        if len(self._buffer) > 2000:
            self._buffer = self._buffer[-1000:]
    
    def _make_write_wrapper(self, original_write):
        def wrapper(text):
            self._check_for_rate_limit(str(text))
            return original_write(text)
        return wrapper
    
    def __enter__(self):
        self._original_stdout_write = sys.stdout.write
        self._original_stderr_write = sys.stderr.write
        sys.stdout.write = self._make_write_wrapper(self._original_stdout_write)
        sys.stderr.write = self._make_write_wrapper(self._original_stderr_write)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self._original_stdout_write:
            sys.stdout.write = self._original_stdout_write
        if self._original_stderr_write:
            sys.stderr.write = self._original_stderr_write
        return False


async def run_agent_session(
    client: ClaudeSDKClient,
    message: str,
    repo_dir: Path,
) -> tuple[str, str]:
    """
    Run a single agent session.

    Returns:
        (status, response_text) where status is:
        - "continue" if agent should continue working
        - "complete" if task is finished
        - "rate_limit" if rate limited
        - "error" if an error occurred
    """
    print("Sending prompt to Claude Agent SDK...\n")

    rate_limit_error = None
    rate_limit_detector = RateLimitDetector()
    
    def is_api_rate_limit_error(text: str) -> bool:
        return bool(RateLimitDetector.API_ERROR_PATTERN.search(text))
    
    try:
        with rate_limit_detector:
            await client.query(message)

            response_text = ""
            async for msg in client.receive_response():
                msg_type = type(msg).__name__
                
                msg_str = str(msg)
                if is_api_rate_limit_error(msg_str):
                    rate_limit_error = msg_str

                if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__

                        if block_type == "TextBlock" and hasattr(block, "text"):
                            text = block.text
                            response_text += text
                            print(text, end="", flush=True)
                        elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                            print(f"\n[Tool: {block.name}]", flush=True)
                            if hasattr(block, "input"):
                                input_str = str(block.input)
                                if len(input_str) > 200:
                                    print(f"   Input: {input_str[:200]}...", flush=True)
                                else:
                                    print(f"   Input: {input_str}", flush=True)

                elif msg_type == "UserMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__

                        if block_type == "ToolResultBlock":
                            result_content = getattr(block, "content", "")
                            is_error = getattr(block, "is_error", False)
                            result_str = str(result_content)

                            if "blocked" in result_str.lower():
                                print(f"   [BLOCKED] {result_content}", flush=True)
                            elif is_error:
                                error_str = result_str[:500]
                                print(f"   [Error] {error_str}", flush=True)
                            else:
                                print("   [Done]", flush=True)
                
                elif msg_type in ("ErrorMessage", "Error") or "error" in msg_type.lower():
                    error_content = str(msg)
                    if is_api_rate_limit_error(error_content):
                        rate_limit_error = error_content
                    print(f"\n[SDK Error] {error_content[:500]}", flush=True)

        print("\n" + "-" * 70 + "\n")
        
        if rate_limit_detector.rate_limit_detected:
            return "rate_limit", rate_limit_detector.error_message
        
        if rate_limit_error:
            return "rate_limit", rate_limit_error
        
        # Check if task was marked complete
        if is_task_complete(repo_dir):
            return "complete", response_text
        
        return "continue", response_text

    except Exception as e:
        error_str = str(e)
        
        if is_api_rate_limit_error(error_str):
            return "rate_limit", error_str
        
        if rate_limit_detector.rate_limit_detected:
            return "rate_limit", rate_limit_detector.error_message
        
        print(f"Error during agent session: {e}")
        return "error", error_str


async def run_feature_agent(
    repo_dir: Path,
    task: str,
    model: str,
    max_iterations: Optional[int] = None,
) -> None:
    """
    Run the feature coding agent loop.

    Args:
        repo_dir: Directory of the existing repository
        task: Task description to implement
        model: Claude model to use
        max_iterations: Maximum number of iterations (None for unlimited)
    """
    print("\n" + "=" * 70)
    print("  FEATURE CODING AGENT")
    print("=" * 70)
    print(f"\nRepository: {repo_dir}")
    print(f"Model: {model}")
    if max_iterations:
        print(f"Max iterations: {max_iterations}")
    else:
        print("Max iterations: Unlimited (will run until task complete)")

    # Check if this is a continuation
    existing_task = load_task(repo_dir)
    is_continuation = existing_task is not None
    
    if is_continuation:
        print("\nContinuing existing task...")
        task = existing_task
        print_task_summary(repo_dir)
        print_progress_summary(repo_dir)
    else:
        print("\nStarting new task...")
        save_task(repo_dir, task)
        # Initialize progress
        progress = get_progress(repo_dir)
        progress["status"] = "in_progress"
        progress["sessions"] = 0
        save_progress(repo_dir, progress)

    # Main loop
    iteration = 0

    while True:
        iteration += 1

        # Check max iterations
        if max_iterations and iteration > max_iterations:
            print(f"\nReached max iterations ({max_iterations})")
            print("To continue, run the script again without --max-iterations")
            break

        # Update session count
        progress = get_progress(repo_dir)
        progress["sessions"] = progress.get("sessions", 0) + 1
        save_progress(repo_dir, progress)

        # Print session header
        print_session_header(iteration)

        # Create client
        client = create_client(repo_dir, model)

        # Get prompt
        prompt = get_feature_prompt(task, is_continuation=is_continuation)
        is_continuation = True  # All subsequent sessions are continuations

        # Run session
        async with client:
            status, response = await run_agent_session(client, prompt, repo_dir)

        # Handle status
        if status == "complete":
            print("\n" + "=" * 70)
            print("  TASK COMPLETE!")
            print("=" * 70)
            print_progress_summary(repo_dir)
            break

        elif status == "continue":
            print(f"\nAgent will auto-continue in {AUTO_CONTINUE_DELAY_SECONDS}s...")
            print_progress_summary(repo_dir)
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)

        elif status == "rate_limit":
            await handle_rate_limit(response)
            iteration -= 1  # Retry same session

        elif status == "error":
            print("\nSession encountered an error")
            print("Will retry with a fresh session...")
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)

        if max_iterations is None or iteration < max_iterations:
            print("\nPreparing next session...\n")
            await asyncio.sleep(1)

    # Final summary
    print("\n" + "=" * 70)
    print("  SESSION COMPLETE")
    print("=" * 70)
    print(f"\nRepository: {repo_dir}")
    print_progress_summary(repo_dir)
    print("\nDone!")
