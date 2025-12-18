"""
Prompt Loading Utilities
========================

Functions for loading prompt templates from the prompts directory.
"""

from pathlib import Path


PROMPTS_DIR = Path(__file__).parent / "prompts"


def load_prompt(name: str, **variables) -> str:
    """Load a prompt template and replace variables.
    
    Variables in the template use {{VARIABLE_NAME}} syntax.
    """
    prompt_path = PROMPTS_DIR / f"{name}.md"
    content = prompt_path.read_text()
    
    for key, value in variables.items():
        content = content.replace(f"{{{{{key}}}}}", str(value))
    
    return content


def get_feature_prompt(task: str, is_continuation: bool = False) -> str:
    """Load the feature implementation prompt with task details.
    
    Args:
        task: The task description to implement
        is_continuation: Whether this is a continuation session (currently unused,
                        the prompt handles this by checking .feature-agent/)
    """
    return load_prompt(
        "feature_prompt",
        TASK_DESCRIPTION=task,
    )
