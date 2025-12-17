/**
 * TerminalView Component
 *
 * Integrates xterm.js with WebGL addon for terminal emulation.
 * Connects to PTY through IPC and handles resize events.
 * Includes link detection for file paths and URLs.
 *
 * Requirements: 9.1, 11.1, 11.2, 11.3, 11.4
 */

import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import {
  detectLinks,
  isValidUrl,
  isLikelyFilePath,
} from 'renderer/lib/link-detector'
import {
  parseCommand,
  extractErrorOutput,
  isErrorExitCode,
  type DetectedError,
} from 'renderer/lib/error-detector'
import { useErrorStore } from 'renderer/stores/error-store'
import { TerminalErrors } from './FixButton'
import type { ErrorContext } from 'shared/models'

interface TerminalViewProps {
  ptyId: string
  terminalId: string
  onTitleChange?: (title: string) => void
  onExit?: (code: number) => void
  onErrorContext?: (context: ErrorContext) => void
}

export function TerminalView({
  ptyId,
  terminalId,
  onTitleChange,
  onExit,
  onErrorContext,
}: TerminalViewProps): React.JSX.Element {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const [terminalBuffer, setTerminalBuffer] = useState<string>('')

  const addError = useErrorStore(state => state.addError)

  useEffect(() => {
    if (!terminalRef.current) return

    // Create terminal instance
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
      },
      allowProposedApi: true,
    })

    // Create and load fit addon
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    // Open terminal in DOM
    terminal.open(terminalRef.current)

    // Load WebGL addon for performance
    try {
      const webglAddon = new WebglAddon()
      terminal.loadAddon(webglAddon)
    } catch (error) {
      console.warn(
        'WebGL addon failed to load, falling back to canvas renderer:',
        error
      )
    }

    // Register link provider for clickable links
    terminal.registerLinkProvider({
      provideLinks: (bufferLineNumber: number, callback) => {
        const line = terminal.buffer.active.getLine(bufferLineNumber - 1)
        if (!line) {
          callback(undefined)
          return
        }

        const lineText = line.translateToString(true)
        const detectedLinks = detectLinks(lineText)

        const xtermLinks = detectedLinks
          .filter(link => {
            if (link.type === 'url') {
              return isValidUrl(link.text)
            }
            return isLikelyFilePath(link.text)
          })
          .map(link => ({
            range: {
              start: { x: link.startIndex + 1, y: bufferLineNumber },
              end: { x: link.endIndex, y: bufferLineNumber },
            },
            text: link.text,
            activate: () => {
              if (link.type === 'url') {
                window.api.shell
                  .openExternal({ url: link.text })
                  .catch(error => {
                    console.error('Failed to open URL:', error)
                  })
              } else {
                window.api.shell.openPath({ path: link.text }).catch(error => {
                  console.error('Failed to open file:', error)
                })
              }
            },
          }))

        callback(xtermLinks.length > 0 ? xtermLinks : undefined)
      },
    })

    // Fit terminal to container
    fitAddon.fit()

    // Store refs
    xtermRef.current = terminal
    fitAddonRef.current = fitAddon

    // Set up PTY data listener
    const unsubscribeData = window.api.pty.onData(ptyId, (data: string) => {
      terminal.write(data)
      // Accumulate terminal buffer for error detection
      setTerminalBuffer(prev => prev + data)
    })

    // Set up PTY exit listener
    const unsubscribeExit = window.api.pty.onExit(ptyId, (code: number) => {
      terminal.write(`\r\n\r\n[Process exited with code ${code}]\r\n`)

      // Detect errors on non-zero exit codes
      if (isErrorExitCode(code)) {
        const command = parseCommand(terminalBuffer)
        const errorOutput = extractErrorOutput(terminalBuffer)

        const error: DetectedError = {
          id: `error-${Date.now()}-${Math.random()}`,
          terminalId,
          command,
          exitCode: code,
          errorOutput,
          timestamp: new Date(),
          lineNumber: terminal.buffer.active.cursorY,
        }

        addError(error)
      }

      // Clear buffer after processing
      setTerminalBuffer('')

      if (onExit) {
        onExit(code)
      }
    })

    // Handle terminal input
    const disposable = terminal.onData((data: string) => {
      window.api.pty.write({ ptyId, data }).catch(error => {
        console.error('Failed to write to PTY:', error)
      })
    })

    // Handle terminal title changes
    const titleDisposable = terminal.onTitleChange((title: string) => {
      if (onTitleChange) {
        onTitleChange(title)
      }
    })

    // Handle resize events
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit()
        const dimensions = fitAddonRef.current.proposeDimensions()
        if (dimensions) {
          window.api.pty
            .resize({
              ptyId,
              cols: dimensions.cols,
              rows: dimensions.rows,
            })
            .catch(error => {
              console.error('Failed to resize PTY:', error)
            })
        }
      }
    })

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current)
    }

    // Cleanup
    return () => {
      unsubscribeData()
      unsubscribeExit()
      disposable.dispose()
      titleDisposable.dispose()
      resizeObserver.disconnect()
      terminal.dispose()
    }
  }, [ptyId, terminalId, onTitleChange, onExit, terminalBuffer, addError])

  return (
    <div className="relative w-full h-full">
      <div
        className="w-full h-full"
        ref={terminalRef}
        style={{ backgroundColor: '#1e1e1e' }}
      />
      <TerminalErrors onErrorContext={onErrorContext} terminalId={terminalId} />
    </div>
  )
}
