/**
 * JWT Decoder Tool
 * Decodes and displays JWT token contents
 */

import { useState, useMemo } from 'react'
import { Textarea } from 'renderer/components/ui/textarea'
import { Badge } from 'renderer/components/ui/badge'
import { ScrollArea } from 'renderer/components/ui/scroll-area'
import { IconAlertCircle, IconCheck, IconClock } from '@tabler/icons-react'
import { decodeJWT } from 'renderer/lib/devtools-utils'

export function JWTDecoder(): React.JSX.Element {
  const [token, setToken] = useState('')

  const decoded = useMemo(() => {
    if (!token.trim()) return null
    return decodeJWT(token)
  }, [token])

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'N/A'
    return date.toLocaleString()
  }

  return (
    <div className="flex flex-col h-full gap-3">
      <div>
        <Textarea
          className="font-mono text-xs min-h-[80px] resize-none"
          onChange={e => setToken(e.target.value)}
          placeholder="Paste your JWT token here..."
          value={token}
        />
      </div>

      {decoded && (
        <ScrollArea className="flex-1">
          {decoded.error ? (
            <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive">
              <IconAlertCircle className="h-4 w-4 shrink-0" />
              <span className="text-xs">{decoded.error}</span>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status badges */}
              <div className="flex items-center gap-2">
                {decoded.isExpired ? (
                  <Badge className="bg-destructive/10 text-destructive border-destructive/30" variant="outline">
                    <IconAlertCircle className="h-3 w-3 mr-1" />
                    Expired
                  </Badge>
                ) : decoded.expiresAt ? (
                  <Badge className="bg-green-500/10 text-green-600 border-green-500/30" variant="outline">
                    <IconCheck className="h-3 w-3 mr-1" />
                    Valid
                  </Badge>
                ) : null}
                {decoded.expiresAt && (
                  <Badge variant="secondary">
                    <IconClock className="h-3 w-3 mr-1" />
                    Expires: {formatDate(decoded.expiresAt)}
                  </Badge>
                )}
              </div>

              {/* Header */}
              <div>
                <h4 className="text-xs font-medium mb-2 text-muted-foreground">
                  Header
                </h4>
                <pre className="p-3 rounded-md bg-muted text-xs font-mono overflow-x-auto">
                  {JSON.stringify(decoded.header, null, 2)}
                </pre>
              </div>

              {/* Payload */}
              <div>
                <h4 className="text-xs font-medium mb-2 text-muted-foreground">
                  Payload
                </h4>
                <pre className="p-3 rounded-md bg-muted text-xs font-mono overflow-x-auto">
                  {JSON.stringify(decoded.payload, null, 2)}
                </pre>
              </div>

              {/* Timestamps */}
              {(decoded.issuedAt || decoded.expiresAt) && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  {decoded.issuedAt && (
                    <div>
                      <span className="text-muted-foreground">Issued At:</span>
                      <div className="font-mono">{formatDate(decoded.issuedAt)}</div>
                    </div>
                  )}
                  {decoded.expiresAt && (
                    <div>
                      <span className="text-muted-foreground">Expires At:</span>
                      <div className="font-mono">{formatDate(decoded.expiresAt)}</div>
                    </div>
                  )}
                </div>
              )}

              {/* Signature */}
              <div>
                <h4 className="text-xs font-medium mb-2 text-muted-foreground">
                  Signature
                </h4>
                <div className="p-3 rounded-md bg-muted text-xs font-mono break-all text-muted-foreground">
                  {decoded.signature}
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
      )}

      {!decoded && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
          Paste a JWT token above to decode it
        </div>
      )}
    </div>
  )
}
