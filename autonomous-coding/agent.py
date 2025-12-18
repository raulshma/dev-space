"""
Agent Session Logic
===================

Core agent interaction functions for running autonomous coding sessions.
"""

import asyncio
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from claude_code_sdk import ClaudeSDKClient

from client import create_client
from progress import print_session_header, print_progress_summary
from prompts import get_initializer_prompt, get_coding_prompt, copy_spec_to_project


# Configuration
AUTO_CONTINUE_DELAY_SECONDS = 3
DEFAULT_RATE_LIMIT_WAIT_MINUTES = 30
RATE_LIMIT_BUFFER_SECONDS = 60  # Wait 1 minute after reset time
RATE_LIMIT_RESUME_INTERVAL_SECONDS = 30 * 60  # Try resuming every 30 minutes during long waits


def parse_rate_limit_reset_time(error_message: str) -> Optional[datetime]:
    """
    Parse the reset time from a 429 rate limit error message.
    
    Expected format: "Your limit will reset at 2025-12-10 23:05:06"
    
    Returns:
        datetime object if found, None otherwise
    """
    # Pattern to match the reset time in the error message
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
    """
    Display a countdown timer that updates at a specified interval.
    
    Args:
        seconds: Number of seconds to count down
        message: Message to display with the countdown
        update_interval: How often to update the display (default: 30 seconds)
    """
    while seconds > 0:
        hours, remainder = divmod(seconds, 3600)
        minutes, secs = divmod(remainder, 60)
        
        if hours > 0:
            time_str = f"{hours:02d}:{minutes:02d}:{secs:02d}"
        else:
            time_str = f"{minutes:02d}:{secs:02d}"
        
        # Use carriage return to update the same line
        sys.stdout.write(f"\r{message}: {time_str}   ")
        sys.stdout.flush()
        
        # Sleep for the update interval or remaining time, whichever is smaller
        sleep_time = min(update_interval, seconds)
        await asyncio.sleep(sleep_time)
        seconds -= sleep_time
    
    # Clear the line when done
    sys.stdout.write("\r" + " " * 60 + "\r")
    sys.stdout.flush()


async def handle_rate_limit(error_message: str) -> None:
    """
    Handle a 429 rate limit error by waiting until the reset time.
    - If reset time is known, wait until reset + 1 minute.
    - If the wait exceeds 30 minutes, wake up every 30 minutes to retry early.
    
    Args:
        error_message: The error message from the API
    """
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
            print(f"Current time: {now.strftime('%Y-%m-%d %H:%M:%S')}")
            print(f"Will retry at: {retry_time.strftime('%Y-%m-%d %H:%M:%S')}")
            
            if wait_seconds > RATE_LIMIT_RESUME_INTERVAL_SECONDS:
                next_wait = min(wait_seconds, RATE_LIMIT_RESUME_INTERVAL_SECONDS)
                next_check = now + timedelta(seconds=next_wait)
                print(
                    f"\nLong wait detected (>30m). Will attempt to resume every 30 minutes."
                )
                print(
                    f"Next resume attempt at: {next_check.strftime('%Y-%m-%d %H:%M:%S')}"
                )
                print(
                    f"Full retry target (reset + buffer): {retry_time.strftime('%Y-%m-%d %H:%M:%S')}\n"
                )
                await countdown_timer(next_wait, "Next retry window")
                print("\nAttempting to resume agent after interval...")
            else:
                print(
                    f"\nWaiting {wait_seconds} seconds (reset time + {RATE_LIMIT_BUFFER_SECONDS}s buffer)...\n"
                )
                await countdown_timer(wait_seconds, "Time until retry")
                print("\nResuming agent...")
        else:
            # Reset time is in the past, wait default time
            print(f"\nReset time appears to be in the past. Waiting {DEFAULT_RATE_LIMIT_WAIT_MINUTES} minutes...")
            await countdown_timer(DEFAULT_RATE_LIMIT_WAIT_MINUTES * 60, "Time until retry")
    else:
        # Couldn't parse reset time, use default wait
        print(f"\nCouldn't parse reset time from error. Waiting {DEFAULT_RATE_LIMIT_WAIT_MINUTES} minutes...")
        print(f"Error message: {error_message[:200]}...")
        default_wait_seconds = DEFAULT_RATE_LIMIT_WAIT_MINUTES * 60
        if default_wait_seconds > RATE_LIMIT_RESUME_INTERVAL_SECONDS:
            await countdown_timer(RATE_LIMIT_RESUME_INTERVAL_SECONDS, "Next retry window")
            print("\nAttempting to resume agent after interval...")
        else:
            await countdown_timer(default_wait_seconds, "Time until retry")
            print("\nResuming agent...")
    
    print("\n" + "=" * 70 + "\n")


class RateLimitDetector:
    """Context manager to detect 429 errors printed to stdout/stderr by the SDK."""
    
    # Precise pattern matching the actual Anthropic API error format:
    # {"type":"error","error":{"type":"1308","message":"Usage limit reached for 5 hour. Your limit will reset at 2025-12-11 18:18:44"}
    API_ERROR_PATTERN = re.compile(
        r'"type"\s*:\s*"error".*"message"\s*:\s*"[^"]*reset at \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}'
    )
    
    def __init__(self):
        self.rate_limit_detected = False
        self.error_message = ""
        self._original_stdout_write = None
        self._original_stderr_write = None
        self._buffer = ""  # Buffer to accumulate partial writes
    
    def _check_for_rate_limit(self, text: str) -> None:
        """Check if text contains a genuine API rate limit error."""
        # Accumulate text in buffer to handle partial JSON writes
        self._buffer += text
        
        # Only match the specific API error JSON format
        if self.API_ERROR_PATTERN.search(self._buffer):
            self.rate_limit_detected = True
            self.error_message = self._buffer
        
        # Keep buffer from growing too large (only need recent output)
        if len(self._buffer) > 2000:
            self._buffer = self._buffer[-1000:]
    
    def _make_write_wrapper(self, original_write):
        """Create a write wrapper that checks for rate limits."""
        def wrapper(text):
            self._check_for_rate_limit(str(text))
            return original_write(text)
        return wrapper
    
    def __enter__(self):
        # Wrap stdout and stderr write methods
        self._original_stdout_write = sys.stdout.write
        self._original_stderr_write = sys.stderr.write
        sys.stdout.write = self._make_write_wrapper(self._original_stdout_write)
        sys.stderr.write = self._make_write_wrapper(self._original_stderr_write)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        # Restore original write methods
        if self._original_stdout_write:
            sys.stdout.write = self._original_stdout_write
        if self._original_stderr_write:
            sys.stderr.write = self._original_stderr_write
        return False


async def run_agent_session(
    client: ClaudeSDKClient,
    message: str,
    project_dir: Path,
) -> tuple[str, str]:
    """
    Run a single agent session using Claude Agent SDK.

    Args:
        client: Claude SDK client
        message: The prompt to send
        project_dir: Project directory path

    Returns:
        (status, response_text) where status is:
        - "continue" if agent should continue working
        - "rate_limit" if rate limited (429)
        - "error" if an error occurred
    """
    print("Sending prompt to Claude Agent SDK...\n")

    # Track if we hit a rate limit during the session
    rate_limit_error = None
    rate_limit_detector = RateLimitDetector()
    
    def is_api_rate_limit_error(text: str) -> bool:
        """Check if text is a genuine Anthropic API rate limit error (not user code)."""
        # Must match the specific API error JSON format with reset timestamp
        return bool(RateLimitDetector.API_ERROR_PATTERN.search(text))
    
    try:
        with rate_limit_detector:
            # Send the query
            await client.query(message)

            # Collect response text and show tool use
            response_text = ""
            async for msg in client.receive_response():
                msg_type = type(msg).__name__
                
                # Check for API error messages in any message type
                msg_str = str(msg)
                if is_api_rate_limit_error(msg_str):
                    rate_limit_error = msg_str
                    print(f"\nAPI Error: 429 detected in response")

                # Handle AssistantMessage (text and tool use)
                if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__

                        if block_type == "TextBlock" and hasattr(block, "text"):
                            text = block.text
                            response_text += text
                            # Don't check text blocks - these are Claude's responses, not API errors
                            print(text, end="", flush=True)
                        elif block_type == "ToolUseBlock" and hasattr(block, "name"):
                            print(f"\n[Tool: {block.name}]", flush=True)
                            if hasattr(block, "input"):
                                input_str = str(block.input)
                                if len(input_str) > 200:
                                    print(f"   Input: {input_str[:200]}...", flush=True)
                                else:
                                    print(f"   Input: {input_str}", flush=True)

                # Handle UserMessage (tool results)
                elif msg_type == "UserMessage" and hasattr(msg, "content"):
                    for block in msg.content:
                        block_type = type(block).__name__

                        if block_type == "ToolResultBlock":
                            result_content = getattr(block, "content", "")
                            is_error = getattr(block, "is_error", False)
                            result_str = str(result_content)
                            
                            # Don't check tool results - these are from user's code/tools

                            # Check if command was blocked by security hook
                            if "blocked" in result_str.lower():
                                print(f"   [BLOCKED] {result_content}", flush=True)
                            elif is_error:
                                # Show errors (truncated)
                                error_str = result_str[:500]
                                print(f"   [Error] {error_str}", flush=True)
                            else:
                                # Tool succeeded - just show brief confirmation
                                print("   [Done]", flush=True)
                
                # Handle ErrorMessage or similar error types from SDK
                elif msg_type in ("ErrorMessage", "Error") or "error" in msg_type.lower():
                    error_content = str(msg)
                    if is_api_rate_limit_error(error_content):
                        rate_limit_error = error_content
                    print(f"\n[SDK Error] {error_content[:500]}", flush=True)

        print("\n" + "-" * 70 + "\n")
        
        # Check if we detected a rate limit via stdout/stderr interception
        if rate_limit_detector.rate_limit_detected:
            return "rate_limit", rate_limit_detector.error_message
        
        # Check if we detected a rate limit during the session
        if rate_limit_error:
            return "rate_limit", rate_limit_error
        
        return "continue", response_text

    except Exception as e:
        error_str = str(e)
        
        # Check for genuine API 429 rate limit error (precise pattern match)
        if is_api_rate_limit_error(error_str):
            print(f"API Error: 429 {error_str}")
            return "rate_limit", error_str
        
        # Also check if the detector caught something
        if rate_limit_detector.rate_limit_detected:
            return "rate_limit", rate_limit_detector.error_message
        
        print(f"Error during agent session: {e}")
        return "error", error_str


async def run_autonomous_agent(
    project_dir: Path,
    model: str,
    max_iterations: Optional[int] = None,
) -> None:
    """
    Run the autonomous agent loop.

    Args:
        project_dir: Directory for the project
        model: Claude model to use
        max_iterations: Maximum number of iterations (None for unlimited)
    """
    print("\n" + "=" * 70)
    print("  AUTONOMOUS CODING AGENT DEMO")
    print("=" * 70)
    print(f"\nProject directory: {project_dir}")
    print(f"Model: {model}")
    if max_iterations:
        print(f"Max iterations: {max_iterations}")
    else:
        print("Max iterations: Unlimited (will run until completion)")
    print()

    # Create project directory
    project_dir.mkdir(parents=True, exist_ok=True)

    # Check if this is a fresh start or continuation
    tests_file = project_dir / "feature_list.json"
    is_first_run = not tests_file.exists()

    if is_first_run:
        print("Fresh start - will use initializer agent")
        print()
        print("=" * 70)
        print("  NOTE: First session takes 10-20+ minutes!")
        print("  The agent is generating 200 detailed test cases.")
        print("  This may appear to hang - it's working. Watch for [Tool: ...] output.")
        print("=" * 70)
        print()
        # Copy the app spec into the project directory for the agent to read
        copy_spec_to_project(project_dir)
    else:
        print("Continuing existing project")
        print_progress_summary(project_dir)

    # Main loop
    iteration = 0

    while True:
        iteration += 1

        # Check max iterations
        if max_iterations and iteration > max_iterations:
            print(f"\nReached max iterations ({max_iterations})")
            print("To continue, run the script again without --max-iterations")
            break

        # Print session header
        print_session_header(iteration, is_first_run)

        # Create client (fresh context)
        client = create_client(project_dir, model)

        # Choose prompt based on session type
        if is_first_run:
            prompt = get_initializer_prompt()
            is_first_run = False  # Only use initializer once
        else:
            prompt = get_coding_prompt()

        # Run session with async context manager
        async with client:
            status, response = await run_agent_session(client, prompt, project_dir)

        # Handle status
        if status == "continue":
            print(f"\nAgent will auto-continue in {AUTO_CONTINUE_DELAY_SECONDS}s...")
            print_progress_summary(project_dir)
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)

        elif status == "rate_limit":
            # Handle 429 rate limit with countdown timer
            await handle_rate_limit(response)
            # Don't increment iteration, retry the same session
            iteration -= 1

        elif status == "error":
            print("\nSession encountered an error")
            print("Will retry with a fresh session...")
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)

        # Small delay between sessions
        if max_iterations is None or iteration < max_iterations:
            print("\nPreparing next session...\n")
            await asyncio.sleep(1)

    # Final summary
    print("\n" + "=" * 70)
    print("  SESSION COMPLETE")
    print("=" * 70)
    print(f"\nProject directory: {project_dir}")
    print_progress_summary(project_dir)

    # Print instructions for running the generated application
    print("\n" + "-" * 70)
    print("  TO RUN THE GENERATED APPLICATION:")
    print("-" * 70)
    print(f"\n  cd {project_dir.resolve()}")
    print("  ./init.sh           # Run the setup script")
    print("  # Or manually:")
    print("  npm install && npm run dev")
    print("\n  Then open http://localhost:3000 (or check init.sh for the URL)")
    print("-" * 70)

    print("\nDone!")
