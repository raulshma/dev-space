/**
 * JSON Formatter Tool
 * Formats, validates, and minifies JSON
 */

import { useState, useCallback } from 'react'
import { Button } from 'renderer/components/ui/button'
import { Textarea } from 'renderer/components/ui/textarea'
import { Badge } from 'renderer/components/ui/badge'
import {
  IconCheck,
  IconX,
  IconCopy,
  IconArrowsMinimize,
  IconCode,
  IconSortAscending,
} from '@tabler/icons-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from 'renderer/components/ui/tooltip'
import {
  formatJSON,
  minifyJSON,
  validateJSON,
} from 'renderer/lib/devtools-utils'

export function JSONFormatter(): React.JSX.Element {
  const [input, setInput] = useState('')
  const [indent, setIndent] = useState(2)
  const [sortKeys, setSortKeys] = useState(false)
  const [validation, setValidation] = useState<{
    valid: boolean
    error?: string
  } | null>(null)

  const handleFormat = useCallback(() => {
    const result = formatJSON(input, indent, sortKeys)
    if (result.valid) {
      setInput(result.formatted)
      setValidation({ valid: true })
    } else {
      setValidation({ valid: false, error: result.error })
    }
  }, [input, indent, sortKeys])

  const handleMinify = useCallback(() => {
    const result = minifyJSON(input)
    if (result.valid) {
      setInput(result.formatted)
      setValidation({ valid: true })
    } else {
      setValidation({ valid: false, error: result.error })
    }
  }, [input])

  const handleValidate = useCallback(() => {
    const result = validateJSON(input)
    setValidation({ valid: result.valid, error: result.error })
  }, [input])

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(input)
  }, [input])

  const handleInputChange = useCallback((value: string) => {
    setInput(value)
    setValidation(null)
  }, [])

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button
            className="h-7 text-xs"
            onClick={handleFormat}
            size="sm"
            variant="outline"
          >
            <IconCode className="h-3.5 w-3.5 mr-1" />
            Format
          </Button>
          <Button
            className="h-7 text-xs"
            onClick={handleMinify}
            size="sm"
            variant="outline"
          >
            <IconArrowsMinimize className="h-3.5 w-3.5 mr-1" />
            Minify
          </Button>
          <Button
            className="h-7 text-xs"
            onClick={handleValidate}
            size="sm"
            variant="outline"
          >
            <IconCheck className="h-3.5 w-3.5 mr-1" />
            Validate
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  className={`h-7 w-7 ${sortKeys ? 'bg-primary/10' : ''}`}
                  onClick={() => setSortKeys(!sortKeys)}
                  size="icon-sm"
                  variant="outline"
                >
                  <IconSortAscending className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <TooltipContent>Sort keys alphabetically</TooltipContent>
          </Tooltip>

          <select
            className="h-7 px-2 text-xs rounded-md border border-input bg-background"
            onChange={e => setIndent(parseInt(e.target.value, 10))}
            value={indent}
          >
            <option value={2}>2 spaces</option>
            <option value={4}>4 spaces</option>
            <option value={1}>1 space</option>
          </select>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  className="h-7 w-7"
                  disabled={!input}
                  onClick={handleCopy}
                  size="icon-sm"
                  variant="outline"
                >
                  <IconCopy className="h-3.5 w-3.5" />
                </Button>
              }
            />
            <TooltipContent>Copy to clipboard</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Validation status */}
      {validation && (
        <div className="flex items-center gap-2">
          {validation.valid ? (
            <Badge
              className="bg-green-500/10 text-green-600 border-green-500/30"
              variant="outline"
            >
              <IconCheck className="h-3 w-3 mr-1" />
              Valid JSON
            </Badge>
          ) : (
            <Badge
              className="bg-destructive/10 text-destructive border-destructive/30"
              variant="outline"
            >
              <IconX className="h-3 w-3 mr-1" />
              {validation.error || 'Invalid JSON'}
            </Badge>
          )}
        </div>
      )}

      {/* Editor */}
      <Textarea
        className="flex-1 font-mono text-xs resize-none min-h-[200px]"
        onChange={e => handleInputChange(e.target.value)}
        placeholder="Paste your JSON here..."
        value={input}
      />
    </div>
  )
}
