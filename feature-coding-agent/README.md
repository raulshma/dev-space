# Feature Coding Agent

A minimal harness for running an autonomous coding agent on existing repositories to implement small tasks and features using the Claude Agent SDK.

## Prerequisites

**Required:** Install the latest versions of both Claude Code and the Claude Agent SDK:

```bash
# Install Claude Code CLI (latest version required)
npm install -g @anthropic-ai/claude-code

# Install Python dependencies
pip install -r requirements.txt
```

**API Key:** Set your Anthropic API key:
```bash
export ANTHROPIC_API_KEY='your-api-key-here'
```

## Quick Start

```bash
# Run with a task description
python feature_agent.py --repo-dir /path/to/your/repo --task "Add a dark mode toggle to the settings page"

# Run with a task file
python feature_agent.py --repo-dir /path/to/your/repo --task-file task.md

# Limit iterations for testing
python feature_agent.py --repo-dir /path/to/your/repo --task "Fix the login bug" --max-iterations 3
```

## How It Works

Unlike the autonomous-coding agent that builds entire applications from scratch, this agent:

1. **Works on existing code** - Analyzes your repository structure and codebase
2. **Focuses on small tasks** - Implements specific features, fixes bugs, or makes improvements
3. **Preserves context** - Understands your project's patterns and conventions
4. **Iterates until done** - Continues across sessions until the task is complete

### Session Flow

1. **Orientation** - Agent reads the codebase, understands structure and patterns
2. **Planning** - Creates a task breakdown with verification steps
3. **Implementation** - Makes changes incrementally with commits
4. **Verification** - Tests changes work correctly
5. **Completion** - Marks task done when all criteria met

## Security Model

Uses the same defense-in-depth approach as autonomous-coding:

1. **OS-level Sandbox** - Bash commands run in isolation
2. **Filesystem Restrictions** - Operations restricted to the repository
3. **Bash Allowlist** - Only permitted commands can run (see `security.py`)

## Project Structure

```
feature-coding-agent/
├── feature_agent.py      # Main entry point
├── agent.py              # Agent session logic
├── client.py             # Claude SDK client configuration
├── security.py           # Bash command allowlist and validation
├── progress.py           # Progress tracking utilities
├── prompts.py            # Prompt loading utilities
├── prompts/
│   └── feature_prompt.md # Feature implementation prompt
└── requirements.txt      # Python dependencies
```

## Command Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--repo-dir` | Path to existing repository | Required |
| `--task` | Task description (inline) | - |
| `--task-file` | Path to task description file | - |
| `--max-iterations` | Max agent iterations | Unlimited |
| `--model` | Claude model to use | `claude-sonnet-4-5-20250929` |

## Task Description Tips

Good task descriptions include:
- Clear objective (what should be accomplished)
- Acceptance criteria (how to verify it's done)
- Any constraints or preferences
- Related files or areas of the codebase

Example:
```markdown
## Task: Add Dark Mode Toggle

Add a dark mode toggle to the settings page that:
- Persists the user's preference in localStorage
- Applies immediately without page reload
- Uses the existing color palette from tailwind.config.js

### Acceptance Criteria
- Toggle visible on /settings page
- Preference persists across sessions
- All pages respect the dark mode setting
```

## Progress Tracking

Progress is tracked in `.feature-agent/` directory:
- `task.md` - The current task description
- `progress.json` - Task status and completion criteria
- `session-notes.txt` - Notes from each session

## Troubleshooting

**"Repository not found"**
Ensure `--repo-dir` points to a valid git repository.

**"Command blocked by security hook"**
The agent tried to run a disallowed command. Add it to `ALLOWED_COMMANDS` in `security.py` if needed.

**"API key not set"**
Export `ANTHROPIC_API_KEY` in your shell environment.

## License

Internal Anthropic use.
