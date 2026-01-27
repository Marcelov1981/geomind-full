const KEY_MAP = {
  OPENAI: 'VITE_OPENAI_API_KEY',
  ANTHROPIC: 'VITE_ANTHROPIC_API_KEY',
  GOOGLE_VISION: 'VITE_GOOGLE_VISION_KEY',
  OPENCAGE: 'VITE_OPENCAGE_API_KEY',
  MAPBOX: 'VITE_MAPBOX_API_KEY',
  GOOGLE_MAPS: 'VITE_GOOGLE_MAPS_API_KEY'
}

const ApiKeyStore = {
  get(name) {
    try {
      const k = localStorage.getItem(`geomind_api_key_${name}`)
      return k || ''
    } catch {
      return ''
    }
  },
  set(name, value) {
    try {
      localStorage.setItem(`geomind_api_key_${name}`, value || '')
      return true
    } catch {
      return false
    }
  },
  all() {
    const result = {}
    Object.keys(KEY_MAP).forEach(n => { result[n] = this.get(n) })
    return result
  }
}

export default ApiKeyStore
