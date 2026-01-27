class POIService {
  static async nearbyAmenities(lat, lng, radius = 1500) {
    const amenities = [
      'school','hospital','clinic','university','kindergarten',
      'supermarket','mall','market','convenience',
      'park','garden','playground','sports_centre','stadium',
      'bus_station','bus_stop','tram_stop','subway_entrance','train_station',
      'pharmacy','bank','post_office'
    ]
    const queryParts = amenities.map(a => `node(around:${radius},${lat},${lng})[amenity=${a}];`)
    const data = `[out:json];(${queryParts.join('')});out body;`
    try {
      const resp = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data })
      })
      const json = await resp.json()
      const elements = Array.isArray(json.elements) ? json.elements : []
      const items = elements.map(e => ({
        id: e.id,
        lat: e.lat,
        lng: e.lon,
        amenity: e.tags?.amenity || null,
        name: e.tags?.name || null,
        address: e.tags?.addr_full || null
      }))
      const summary = {}
      items.forEach(i => { summary[i.amenity] = (summary[i.amenity] || 0) + 1 })
      return {
        total: items.length,
        summary,
        items
      }
    } catch {
      return { total: 0, summary: {}, items: [] }
    }
  }
}

export default POIService
