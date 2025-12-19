/**
 * Planning Mode Selector Component
 *
 * Dropdown for selecting planning mode (skip/lite/spec/full)
 * with an optional approval required checkbox.
 *
 * Requirements: 3.1
 */

import { useCallback } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from 'renderer/components/ui/select'
import { Checkbox } from 'renderer/components/ui/checkbox'
import { Label } from 'renderer/components/ui/label'
import {
  IconPlayerSkipForward,
  IconListDetails,
  IconFileDescription,
  IconFileAnalytics,
} from '@tabler/icons-react'
import type { PlanningMode } from 'shared/ai-types'

interface PlanningModeSelectorProps {
  value: PlanningMode
  onChange: (mode: PlanningMode) => void
  requireApproval: boolean
  onRequireApprovalChange: (required: boolean) => void
  disabled?: boolean
  className?: string
}

interface PlanningModeOption {
  value: PlanningMode
  label: string
  description: string
  icon: React.ReactNode
}

const PLANNING_MODE_OPTIONS: PlanningModeOption[] = [
  {
    value: 'skip',
    label: 'Skip',
    description: 'Proceed directly to implementation without a plan',
    icon: <IconPlayerSkipForward className="h-4 w-4" />,
  },
  {
    value: 'lite',
    label: 'Lite',
    description: 'Brief outline with goal, approach, files, and tasks',
    icon: <IconListDetails className="h-4 w-4" />,
  },
  {
    value: 'spec',
    label: 'Spec',
    description: 'Specification with acceptance criteria and file modifications',
    icon: <IconFileDescription className="h-4 w-4" />,
  },
  {
    value: 'full',
    label: 'Full',
    description: 'Comprehensive spec with user story, phased tasks, and risk analysis',
    icon: <IconFileAnalytics className="h-4 w-4" />,
  },
]

/**
 * Get icon for a planning mode
 */
function getPlanningModeIcon(mode: PlanningMode): React.ReactNode {
  const option = PLANNING_MODE_OPTIONS.find(o => o.value === mode)
  return option?.icon ?? <IconListDetails className="h-4 w-4" />
}

export function PlanningModeSelector({
  value,
  onChange,
  requireApproval,
  onRequireApprovalChange,
  disabled = false,
  className,
}: PlanningModeSelectorProps): React.JSX.Element {
  const handleModeChange = useCallback(
    (newValue: string | null) => {
      if (newValue) {
        onChange(newValue as PlanningMode)
      }
    },
    [onChange]
  )

  const handleApprovalChange = useCallback(
    (checked: boolean) => {
      onRequireApprovalChange(checked)
    },
    [onRequireApprovalChange]
  )

  const selectedOption = PLANNING_MODE_OPTIONS.find(o => o.value === value)
  const showApprovalCheckbox = value !== 'skip'

  return (
    <div className={className}>
      <div className="space-y-3">
        {/* Planning Mode Dropdown */}
        <div className="space-y-2">
          <Label htmlFor="planning-mode">Planning Mode</Label>
          <Select
            disabled={disabled}
            onValueChange={handleModeChange}
            value={value}
          >
            <SelectTrigger className="w-full" id="planning-mode">
              <SelectValue>
                <span className="flex items-center gap-2">
                  {getPlanningModeIcon(value)}
                  <span>{selectedOption?.label ?? value}</span>
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {PLANNING_MODE_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  <span className="flex items-center gap-2">
                    {option.icon}
                    <span className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedOption && (
            <p className="text-xs text-muted-foreground">
              {selectedOption.description}
            </p>
          )}
        </div>

        {/* Approval Required Checkbox */}
        {showApprovalCheckbox && (
          <div className="flex items-center gap-2">
            <Checkbox
              checked={requireApproval}
              disabled={disabled}
              id="require-approval"
              onCheckedChange={handleApprovalChange}
            />
            <Label
              className="text-sm font-normal cursor-pointer"
              htmlFor="require-approval"
            >
              Require plan approval before implementation
            </Label>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Compact version of PlanningModeSelector for inline use
 */
export function CompactPlanningModeSelector({
  value,
  onChange,
  disabled = false,
  className,
}: Omit<
  PlanningModeSelectorProps,
  'requireApproval' | 'onRequireApprovalChange'
>): React.JSX.Element {
  const handleModeChange = useCallback(
    (newValue: string | null) => {
      if (newValue) {
        onChange(newValue as PlanningMode)
      }
    },
    [onChange]
  )

  const selectedOption = PLANNING_MODE_OPTIONS.find(o => o.value === value)

  return (
    <Select
      disabled={disabled}
      onValueChange={handleModeChange}
      value={value}
    >
      <SelectTrigger className={className}>
        <SelectValue>
          <span className="flex items-center gap-2">
            {getPlanningModeIcon(value)}
            <span>{selectedOption?.label ?? value}</span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PLANNING_MODE_OPTIONS.map(option => (
          <SelectItem key={option.value} value={option.value}>
            <span className="flex items-center gap-2">
              {option.icon}
              <span>{option.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { PLANNING_MODE_OPTIONS }
