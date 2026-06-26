'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

const CAT_COLORS: Record<string, string> = {
  Education:      '#3b82f6',
  Infrastructure: '#f97316',
  Health:         '#10b981',
  Water:          '#06b6d4',
  Electricity:    '#eab308',
  Corruption:     '#dc2626',
  Safety:         '#8b5cf6',
  Environment:    '#84cc16',
  Other:          '#71717a',
}

interface WardComplaint {
  id: string
  category_en: string
  category_ne: string
  severity: number
  summary_ne?: string
  status: string
}

interface WardMapProps {
  wardId: number
  wardName: string
  lat: number
  lng: number
  complaints: WardComplaint[]
  onSelect?: (c: WardComplaint) => void
}

// Scatter complaints around ward center within ~500m radius
function scatterCoord(centerLat: number, centerLng: number, index: number, total: number): [number, number] {
  // Deterministic scatter using index so positions don't change on re-render
  const seed = index * 137.508 + 42 // golden angle
  const angle = (seed % 360) * (Math.PI / 180)
  const radius = 0.002 + (index % 5) * 0.0008 // 200–600m spread
  return [
    centerLat + radius * Math.sin(angle),
    centerLng + radius * Math.cos(angle),
  ]
}

export default function WardMapComponent({ wardId, wardName, lat, lng, complaints, onSelect }: WardMapProps) {
  const mapRef  = useRef<HTMLDivElement>(null)
  const mapInst = useRef<L.Map | null>(null)

  useEffect(() => {
    if (!mapRef.current) return
    const el = mapRef.current as HTMLDivElement & { _leaflet_id?: number }
    if (el._leaflet_id || mapInst.current) return

    import('leaflet').then((L) => {
      if (!mapRef.current) return
      const el2 = mapRef.current as HTMLDivElement & { _leaflet_id?: number }
      if (el2._leaflet_id) return

      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom:   14,
        minZoom: 12,
        maxZoom: 18,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // Ward area circle (approximate boundary)
      L.circle([lat, lng], {
        radius:      600,
        color:       '#22c55e',
        weight:      1.5,
        opacity:     0.4,
        fillColor:   '#22c55e',
        fillOpacity: 0.04,
      }).addTo(map)

      // Ward center label
      L.marker([lat, lng], {
        icon: L.divIcon({
          className: '',
          html: `<div style="
            background:#111;border:1px solid #22c55e40;border-radius:8px;
            padding:4px 10px;color:#22c55e;font-size:11px;font-weight:600;
            white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,0.5);
          ">${wardName}</div>`,
          iconAnchor: [40, 30],
        })
      }).addTo(map)

      mapInst.current = map
    })

    return () => {
      if (mapInst.current) { mapInst.current.remove(); mapInst.current = null }
    }
  }, [lat, lng, wardName])

  // Redraw complaint dots when data changes
  useEffect(() => {
    if (!mapInst.current || !complaints.length) return

    import('leaflet').then((L) => {
      const map = mapInst.current
      if (!map) return

      // Remove old complaint markers (keep tile + ward circle)
      map.eachLayer(layer => {
        if (layer instanceof L.Marker || (layer instanceof L.CircleMarker)) {
          map.removeLayer(layer)
        }
      })

      complaints.forEach((c, i) => {
        const [cLat, cLng] = scatterCoord(lat, lng, i, complaints.length)
        const color  = CAT_COLORS[c.category_en] || '#71717a'
        const sev    = c.severity || 5
        const size   = 6 + Math.floor(sev / 2) // 6–11px
        const isCrit = sev >= 8

        const icon = L.divIcon({
          className: '',
          iconSize:  [size * 2.5, size * 2.5],
          iconAnchor:[size * 1.25, size * 1.25],
          html: `<div style="position:relative;width:${size*2.5}px;height:${size*2.5}px;display:flex;align-items:center;justify-content:center;">
            ${isCrit ? `<div style="position:absolute;width:${size*2.5}px;height:${size*2.5}px;border-radius:50%;background:${color};opacity:0.15;animation:sunuwa-pulse 2s ease-out infinite;"></div>` : ''}
            <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:1.5px solid rgba(255,255,255,0.5);box-shadow:0 0 6px ${color}80;position:relative;z-index:2;"></div>
          </div>`,
        })

        const marker = L.marker([cLat, cLng], { icon }).addTo(map)

        marker.bindTooltip(`
          <div style="background:#111;border:1px solid #2a2a2a;border-radius:10px;padding:10px 14px;min-width:160px;box-shadow:0 8px 30px rgba(0,0,0,0.7);">
            <div style="color:${color};font-size:10px;font-weight:700;letter-spacing:0.5px;margin-bottom:4px;">${c.category_ne}</div>
            ${c.summary_ne ? `<div style="color:#d4d4d4;font-size:11px;line-height:1.5;margin-bottom:6px;">${c.summary_ne.slice(0, 70)}${c.summary_ne.length > 70 ? '…' : ''}</div>` : ''}
            <div style="color:#71717a;font-size:10px;">गम्भीरता: ${sev}/10</div>
          </div>
        `, { permanent: false, direction: 'top', className: 'sunuwa-tooltip', opacity: 1 })

        if (onSelect) marker.on('click', () => onSelect(c))
      })
    })
  }, [complaints, lat, lng, onSelect])

  return (
    <>
      <style>{`
        @keyframes sunuwa-pulse { 0%{transform:scale(0.8);opacity:0.4} 70%{transform:scale(2);opacity:0} 100%{transform:scale(0.8);opacity:0} }
        .sunuwa-tooltip { background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important; }
        .leaflet-tooltip-top:before { display:none!important; }
      `}</style>
      <div ref={mapRef} className="w-full h-full rounded-xl overflow-hidden" style={{ background: '#0a0a0a' }} />
    </>
  )
}
