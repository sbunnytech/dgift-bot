// lib/themeCache.js

const themeCache = new Map()

export function setThemeCache(instanceId, data = {}) {
  if (!instanceId) return

  themeCache.set(instanceId, {
    ...data,
    cachedAt: Date.now()
  })
}

export function getThemeCache(instanceId) {
  if (!instanceId) return null

  return themeCache.get(instanceId) || null
}

export function clearThemeCache(instanceId) {
  if (!instanceId) return

  themeCache.delete(instanceId)
}

export function clearAllThemeCache() {
  themeCache.clear()
}

export function hasThemeCache(instanceId) {
  return themeCache.has(instanceId)
}