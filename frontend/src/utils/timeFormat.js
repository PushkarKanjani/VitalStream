/**
 * Shared time-format utility for VitalStream:
 * Handles UTC epoch millisecond formatting, header clocks, and relative time ("ago").
 */

export function formatUtcTime(inputMs) {
  if (!inputMs) return { utcTime: '--:--:--', relativeAgo: 'just now', secondsAgo: 0, fullLabel: '' }

  const ms = typeof inputMs === 'string' ? new Date(inputMs).getTime() : Number(inputMs)
  const d = new Date(ms)

  const pad = (n) => String(n).padStart(2, '0')
  const hours = pad(d.getUTCHours())
  const mins  = pad(d.getUTCMinutes())
  const secs  = pad(d.getUTCSeconds())
  const utcTime = `${hours}:${mins}:${secs} UTC`

  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000))
  let relativeAgo = '0s ago'
  if (diffSec < 60) {
    relativeAgo = `${diffSec}s ago`
  } else if (diffSec < 3600) {
    relativeAgo = `${Math.floor(diffSec / 60)}m ago`
  } else {
    relativeAgo = `${Math.floor(diffSec / 3600)}h ago`
  }

  return {
    utcTime,
    relativeAgo,
    secondsAgo: diffSec,
    fullLabel: `${utcTime} (${relativeAgo})`
  }
}

export function getHeaderClock() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const hours = pad(d.getHours())
  const mins  = pad(d.getMinutes())
  const secs  = pad(d.getSeconds())
  return `${hours}:${mins}:${secs} IST`
}

export function getHeaderUtcClock() {
  return getHeaderClock()
}

