import { useEffect, useRef, useCallback } from 'react'

const WS_URL = 'ws://localhost:5000/ws'
const RECONNECT_DELAY = 3000

/**
 * useWebSocket — auto-reconnecting WebSocket hook
 * @param {(msg: object) => void} onMessage - called with parsed JSON message
 * @returns {{ sendMessage: (data: object) => void, readyState: number }}
 */
export function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const onMessageRef = useRef(onMessage)
  const reconnectTimer = useRef(null)

  // Keep callback ref up to date without re-running effect
  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WS] Connected')
      clearTimeout(reconnectTimer.current)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessageRef.current?.(data)
      } catch (e) {
        console.warn('[WS] Non-JSON message:', event.data)
      }
    }

    ws.onclose = () => {
      console.warn('[WS] Disconnected — reconnecting in 3s…')
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
    }

    ws.onerror = (err) => {
      console.error('[WS] Error:', err)
      ws.close()
    }
  }, [])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }, [])

  return { sendMessage }
}
