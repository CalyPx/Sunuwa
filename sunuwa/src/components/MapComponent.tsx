'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

const CATEGORY_COLORS: Record<string, string> = {
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

interface MapPoint {
  id: number
  lat: number
  lng: number
  category_ne: string
  category_en: string
  summary_ne?: string
  complaint_count?: number
  urgency_score?: number
  escalation_level?: number
  ward?: { name_ne: string; municipality: string; district: string }
}

interface MapComponentProps {
  data: MapPoint[]
  type: string
  onSelect: (point: MapPoint) => void
}

export default function MapComponent({ data, type, onSelect }: MapComponentProps) {
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapInst   = useRef<L.Map | null>(null)

  // ── Init map once ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return
    const el = mapRef.current as HTMLDivElement & { _leaflet_id?: number }
    if (el._leaflet_id || mapInst.current) return   // already initialised

    import('leaflet').then((L) => {
      if (!mapRef.current) return
      const el2 = mapRef.current as HTMLDivElement & { _leaflet_id?: number }
      if (el2._leaflet_id) return   // StrictMode double-fire guard

      // Nepal tight bounds
      const SW = L.latLng(26.0, 79.5)
      const NE = L.latLng(30.8, 88.5)
      const nepalBounds = L.latLngBounds(SW, NE)

      const map = L.map(mapRef.current, {
        center:              [28.1, 84.0],   // Nepal geographic centre
        zoom:                7,
        minZoom:             7,              // can't zoom out past Nepal view
        maxZoom:             16,
        maxBounds:           nepalBounds.pad(0.05),
        maxBoundsViscosity:  1.0,            // hard wall — can't leave Nepal
        zoomControl:         true,
        attributionControl:  true,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains:  'abcd',
        maxZoom:     19,
      }).addTo(map)

      mapInst.current = map
    })

    return () => {
      if (mapInst.current) {
        mapInst.current.remove()
        mapInst.current = null
      }
    }
  }, [])

  // ── Draw markers whenever data changes ───────────────────────────
  useEffect(() => {
    if (!mapInst.current || !data.length) return

    import('leaflet').then((L) => {
      const map = mapInst.current
      if (!map) return

      // Remove old markers
      map.eachLayer((layer) => {
        if (!(layer instanceof L.TileLayer)) map.removeLayer(layer)
      })

      const valid = data.filter((p) => p.lat && p.lng)
      if (!valid.length) return

      valid.forEach((point) => {
        const count   = point.complaint_count || 1
        const urgency = point.urgency_score   || count * 5
        const cat     = point.category_en     || 'Other'

        // Dot size: 10 – 22 px based on complaint count
        const dotSize = Math.min(10 + Math.floor(count / 3), 22)

        // Urgency colour (ring)
        let ringColor = '#3b82f6'
        if      (urgency > 90) ringColor = '#ef4444'
        else if (urgency > 60) ringColor = '#f97316'
        else if (urgency > 30) ringColor = '#f59e0b'

        const catColor = CATEGORY_COLORS[cat] || '#71717a'
        const isCritical = urgency > 60

        // DivIcon: pulse ring + solid dot (Snapchat-style)
        const icon = L.divIcon({
          className: '',   // kill Leaflet's default white box
          iconSize:   [dotSize * 3, dotSize * 3],
          iconAnchor: [dotSize * 1.5, dotSize * 1.5],
          html: `
            <div style="
              position:relative;
              width:${dotSize * 3}px;
              height:${dotSize * 3}px;
              display:flex;
              align-items:center;
              justify-content:center;
            ">
              ${isCritical ? `
              <div style="
                position:absolute;
                width:${dotSize * 3}px;
                height:${dotSize * 3}px;
                border-radius:50%;
                background:${ringColor};
                opacity:0.15;
                animation:sunuwa-pulse 2s ease-out infinite;
              "></div>` : ''}
              <div style="
                position:absolute;
                width:${dotSize * 2}px;
                height:${dotSize * 2}px;
                border-radius:50%;
                background:${ringColor};
                opacity:0.25;
                border:1px solid ${ringColor};
              "></div>
              <div style="
                position:relative;
                width:${dotSize}px;
                height:${dotSize}px;
                border-radius:50%;
                background:${catColor};
                border:2px solid rgba(255,255,255,0.6);
                box-shadow:0 0 8px ${catColor}80;
                z-index:2;
              "></div>
            </div>
          `,
        })

        const marker = L.marker([point.lat, point.lng], { icon }).addTo(map)

        // Hover tooltip
        const tip = `
          <div style="
            font-family:'Noto Sans Devanagari',sans-serif;
            background:#111;
            border:1px solid #2a2a2a;
            border-radius:12px;
            padding:12px 16px;
            min-width:180px;
            box-shadow:0 12px 40px rgba(0,0,0,0.7);
          ">
            <div style="
              color:${catColor};
              font-size:11px;
              font-weight:700;
              letter-spacing:0.5px;
              margin-bottom:6px;
            ">${point.category_ne}</div>
            ${point.summary_ne ? `
            <div style="
              color:#d4d4d4;
              font-size:12px;
              line-height:1.6;
              margin-bottom:8px;
            ">${point.summary_ne.slice(0, 80)}${point.summary_ne.length > 80 ? '…' : ''}</div>` : ''}
            <div style="
              display:flex;
              align-items:center;
              gap:8px;
              color:#71717a;
              font-size:11px;
            ">
              <span style="
                background:${ringColor}20;
                color:${ringColor};
                border:1px solid ${ringColor}40;
                border-radius:20px;
                padding:2px 8px;
                font-size:10px;
              ">urgency ${Math.round(urgency)}</span>
              ${count > 1 ? `<span>${count} उजुरी</span>` : ''}
            </div>
          </div>
        `
        marker.bindTooltip(tip, {
          permanent:  false,
          direction:  'top',
          className:  'sunuwa-tooltip',
          opacity:    1,
          offset:     [0, -dotSize],
        })

        marker.on('click', () => onSelect(point))
      })

      // Auto-fit Nepal if < 2 clusters, else keep default Nepal view
      if (valid.length <= 3) {
        const lats = valid.map((p) => p.lat)
        const lngs = valid.map((p) => p.lng)
        map.fitBounds(
          L.latLngBounds(
            [Math.min(...lats) - 0.2, Math.min(...lngs) - 0.2],
            [Math.max(...lats) + 0.2, Math.max(...lngs) + 0.2]
          ),
          { maxZoom: 13, padding: [60, 60] }
        )
      }
    })
  }, [data, onSelect])

  return (
    <>
      <style>{`
        @keyframes sunuwa-pulse {
          0%   { transform: scale(0.8); opacity: 0.4; }
          70%  { transform: scale(1.8); opacity: 0;   }
          100% { transform: scale(0.8); opacity: 0;   }
        }
        .sunuwa-tooltip {
          background: transparent !important;
          border:      none       !important;
          box-shadow:  none       !important;
          padding:     0          !important;
        }
        .leaflet-tooltip-top:before  { display: none !important; }
        .leaflet-control-attribution {
          background: rgba(10,10,10,0.85) !important;
          color:      #52525b             !important;
          font-size:  10px                !important;
        }
        .leaflet-control-attribution a { color: #71717a !important; }
        .leaflet-control-zoom          { border: 1px solid #2a2a2a !important; }
        .leaflet-control-zoom a {
          background:   #111    !important;
          color:        #d4d4d4 !important;
          border-color: #2a2a2a !important;
        }
        .leaflet-control-zoom a:hover { background: #1f1f1f !important; }
      `}</style>
      <div ref={mapRef} className="w-full h-full" style={{ background: '#0a0a0a' }} />
    </>
  )
}
