import { useEffect, useRef, useCallback } from 'react'

const getWsUrl = () => {
  if (typeof window === 'undefined') return 'ws://localhost:8000/ws'
  const isHttps = window.location.protocol === 'https:'
  const proto = isHttps ? 'wss:' : 'ws:'
  // When running via Vite on port 5173, /ws is proxied to ws://localhost:8000/ws
  // Fallback to localhost:8000 directly if proxy is bypassed
  return `${proto}//${window.location.hostname}:8000/ws`
}

const RECONNECT_DELAY = 3000

/**
 * useWebSocket — auto-reconnecting WebSocket hook
 * @param {(msg: object) => void} onMessage - called with parsed JSON message
 * @returns {{ sendMessage: (data: object) => void }}
 */
export function useWebSocket(onMessage) {
  const wsRef = useRef(null)
  const onMessageRef = useRef(onMessage)
  const reconnectTimer = useRef(null)

  useEffect(() => { onMessageRef.current = onMessage }, [onMessage])

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    try {
      const url = getWsUrl()
      const ws = new WebSocket(url)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('[WS] Connected to', url)
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
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
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
