/**
 * Branch Input Component
 *
 * Text input for specifying a git branch name with validation feedback.
 * Used when creating tasks that should run in isolated branches/worktrees.
 *
 * Requirements: 4.1
 */

import { useState, useCallback, useEffect, memo } from 'react'
import { Input } from 'renderer/components/ui/input'
import { Label } from 'renderer/components/ui/label'
import { Badge } from 'renderer/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import {
  IconGitBranch,
  IconCheck,
  IconAlertTriangle,
  IconInfoCircle,
} from '@tabler/icons-react'
import { cn } from 'renderer/lib/utils'

export interface BranchInputProps {
  /** Current branch name value */
  value: string
  /** Callback when branch name changes */
  onChange: (value: string) => void
  /** Whether the input is disabled */
  disabled?: boolean
  /** Placeholder text */
  placeholder?: string
  /** Optional className for styling */
  className?: string
  /** Whether to show the label */
  showLabel?: boolean
  /** Custom label text */
  label?: string
  /** Helper text shown below the input */
  helperText?: string
  /** Whether to auto-generate a branch name suggestion */
  autoSuggest?: boolean
  /** Task description for auto-suggestion */
  taskDescription?: string
}

/**
 * Validation result for branch names
 */
interface ValidationResult {
  isValid: boolean
  message?: string
  type: 'success' | 'warning' | 'error' | 'info'
}

/**
 * Validate a git branch name according to git rules
 * @see https://git-scm.com/docs/git-check-ref-format
 */
function validateBranchName(name: string): ValidationResult {
  // Empty is valid (optional field)
  if (!name || name.trim() === '') {
    return {
      isValid: true,
      message: 'Optional: Leave empty to use the current branch',
      type: 'info',
    }
  }

  const trimmed = name.trim()

  // Check for invalid characters
  const invalidChars = /[\s~^:?*[\]\\]/
  if (invalidChars.test(trimmed)) {
    return {
      isValid: false,
      message:
        'Branch name cannot contain spaces or special characters (~^:?*[]\\)',
      type: 'error',
    }
  }

  // Cannot start or end with a dot
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
    return {
      isValid: false,
      message: 'Branch name cannot start or end with a dot',
      type: 'error',
    }
  }

  // Cannot contain consecutive dots
  if (trimmed.includes('..')) {
    return {
      isValid: false,
      message: 'Branch name cannot contain consecutive dots (..)',
      type: 'error',
    }
  }

  // Cannot end with .lock
  if (trimmed.endsWith('.lock')) {
    return {
      isValid: false,
      message: 'Branch name cannot end with .lock',
      type: 'error',
    }
  }

  // Cannot start with a dash
  if (trimmed.startsWith('-')) {
    return {
      isValid: false,
      message: 'Branch name cannot start with a dash',
      type: 'error',
    }
  }

  // Cannot contain @{
  if (trimmed.includes('@{')) {
    return {
      isValid: false,
      message: 'Branch name cannot contain @{',
      type: 'error',
    }
  }

  // Cannot be just @
  if (trimmed === '@') {
    return {
      isValid: false,
      message: 'Branch name cannot be just @',
      type: 'error',
    }
  }

  // Warn about common prefixes
  const commonPrefixes = ['feature/', 'bugfix/', 'hotfix/', 'release/']
  const hasPrefix = commonPrefixes.some(prefix => trimmed.startsWith(prefix))

  if (hasPrefix) {
    return {
      isValid: true,
      message: 'Valid branch name with standard prefix',
      type: 'success',
    }
  }

  // Valid branch name
  return {
    isValid: true,
    message: 'Valid branch name',
    type: 'success',
  }
}

/**
 * Generate a branch name suggestion from a task description
 */
function generateBranchSuggestion(description: string): string {
  if (!description) return ''

  // Convert to lowercase and replace spaces with dashes
  let suggestion = description
    .toLowerCase()
    .trim()
    // Remove special characters
    .replace(/[^a-z0-9\s-]/g, '')
    // Replace spaces with dashes
    .replace(/\s+/g, '-')
    // Remove consecutive dashes
    .replace(/-+/g, '-')
    // Remove leading/trailing dashes
    .replace(/^-|-$/g, '')

  // Truncate to reasonable length
  if (suggestion.length > 50) {
    suggestion = suggestion.slice(0, 50).replace(/-$/, '')
  }

  // Add feature prefix if not present
  if (suggestion && !suggestion.startsWith('feature/')) {
    suggestion = `feature/${suggestion}`
  }

  return suggestion
}

export const BranchInput = memo(function BranchInput({
  value,
  onChange,
  disabled = false,
  placeholder = 'feature/my-branch-name',
  className,
  showLabel = true,
  label = 'Branch Name',
  helperText,
  autoSuggest = false,
  taskDescription,
}: BranchInputProps): React.JSX.Element {
  const [validation, setValidation] = useState<ValidationResult>({
    isValid: true,
    type: 'info',
  })
  const [suggestion, setSuggestion] = useState<string>('')

  // Validate on value change
  useEffect(() => {
    const result = validateBranchName(value)
    setValidation(result)
  }, [value])

  // Generate suggestion when task description changes
  useEffect(() => {
    if (autoSuggest && taskDescription && !value) {
      const suggested = generateBranchSuggestion(taskDescription)
      setSuggestion(suggested)
    } else {
      setSuggestion('')
    }
  }, [autoSuggest, taskDescription, value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value)
    },
    [onChange]
  )

  const handleUseSuggestion = useCallback(() => {
    if (suggestion) {
      onChange(suggestion)
      setSuggestion('')
    }
  }, [suggestion, onChange])

  const getValidationIcon = () => {
    switch (validation.type) {
      case 'success':
        return <IconCheck className="h-4 w-4 text-green-500" />
      case 'warning':
        return <IconAlertTriangle className="h-4 w-4 text-amber-500" />
      case 'error':
        return <IconAlertTriangle className="h-4 w-4 text-destructive" />
      default:
        return <IconInfoCircle className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      {showLabel && (
        <Label className="flex items-center gap-2" htmlFor="branch-input">
          <IconGitBranch className="h-4 w-4" />
          {label}
          <Badge className="text-xs font-normal" variant="outline">
            Optional
          </Badge>
        </Label>
      )}

      <div className="relative">
        <Input
          className={cn(
            'pr-10',
            !validation.isValid &&
              'border-destructive focus-visible:ring-destructive'
          )}
          disabled={disabled}
          id="branch-input"
          onChange={handleChange}
          placeholder={placeholder}
          value={value}
        />

        {/* Validation indicator */}
        {value && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="cursor-default">{getValidationIcon()}</span>
                }
              />
              <TooltipContent>
                <p>{validation.message}</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {/* Suggestion */}
      {suggestion && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Suggestion:</span>
          <button
            className="text-primary hover:underline font-mono"
            onClick={handleUseSuggestion}
            type="button"
          >
            {suggestion}
          </button>
        </div>
      )}

      {/* Validation message or helper text */}
      {validation.message && value ? (
        <p
          className={cn(
            'text-xs',
            validation.type === 'error' && 'text-destructive',
            validation.type === 'warning' && 'text-amber-600',
            validation.type === 'success' && 'text-green-600',
            validation.type === 'info' && 'text-muted-foreground'
          )}
        >
          {validation.message}
        </p>
      ) : helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Specify a branch name to isolate this task's changes. A worktree will
          be created automatically.
        </p>
      )}
    </div>
  )
})

/**
 * Compact version of BranchInput for inline use
 */
export interface CompactBranchInputProps {
  /** Current branch name value */
  value: string
  /** Callback when branch name changes */
  onChange: (value: string) => void
  /** Whether the input is disabled */
  disabled?: boolean
  /** Optional className for styling */
  className?: string
}

export const CompactBranchInput = memo(function CompactBranchInput({
  value,
  onChange,
  disabled = false,
  className,
}: CompactBranchInputProps): React.JSX.Element {
  const validation = validateBranchName(value)

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <IconGitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
      <Input
        className={cn(
          'h-8 text-sm',
          !validation.isValid && 'border-destructive'
        )}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        placeholder="Branch name (optional)"
        value={value}
      />
    </div>
  )
})
