"""
Prompt Loading Utilities
========================

Functions for loading prompt templates from the prompts directory.
"""

import shutil
from pathlib import Path


PROMPTS_DIR = Path(__file__).parent / "prompts"

# Default values for template variables
DEFAULT_TEST_COUNT = 200


def load_prompt(name: str, **variables) -> str:
    """Load a prompt template and replace variables.
    
    Variables in the template use {{VARIABLE_NAME}} syntax.
    """
    prompt_path = PROMPTS_DIR / f"{name}.md"
    content = prompt_path.read_text()
    
    for key, value in variables.items():
        content = content.replace(f"{{{{{key}}}}}", str(value))
    
    return content


def get_initializer_prompt(test_count: int = DEFAULT_TEST_COUNT) -> str:
    """Load the initializer prompt with test count variables."""
    comprehensive_count = max(1, int(test_count * 0.12))
    # Scale min steps for comprehensive tests based on test count
    min_comprehensive_steps = 10 if test_count >= 100 else max(5, test_count // 20)
    return load_prompt(
        "initializer_prompt",
        TEST_COUNT=test_count,
        COMPREHENSIVE_COUNT=comprehensive_count,
        MIN_COMPREHENSIVE_STEPS=min_comprehensive_steps,
    )


def get_coding_prompt(test_count: int = DEFAULT_TEST_COUNT) -> str:
    """Load the coding agent prompt with test count variables."""
    return load_prompt("coding_prompt", TEST_COUNT=test_count)


def copy_spec_to_project(project_dir: Path) -> None:
    """Copy the app spec file into the project directory for the agent to read."""
    spec_source = PROMPTS_DIR / "app_spec.txt"
    spec_dest = project_dir / "app_spec.txt"
    if not spec_dest.exists():
        shutil.copy(spec_source, spec_dest)
        print("Copied app_spec.txt to project directory")



