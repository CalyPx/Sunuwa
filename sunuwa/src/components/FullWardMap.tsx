'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

const CAT_COLOR: Record<string, string> = {
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

const CAT_ICON: Record<string, string> = {
  Education: '📚', Infrastructure: '🏗️', Health: '🏥', Water: '💧',
  Electricity: '⚡', Corruption: '⚖️', Safety: '🔒', Environment: '🌿', Other: '📋',
}

const CAT_NE: Record<string, string> = {
  Education: 'शिक्षा', Infrastructure: 'पूर्वाधार', Health: 'स्वास्थ्य',
  Water: 'खानेपानी', Electricity: 'बिजुली', Corruption: 'भ्रष्टाचार',
  Safety: 'सुरक्षा', Environment: 'वातावरण', Other: 'अन्य',
}

// Deterministic scatter — used when no GPS coordinates exist
function scatterCoord(centerLat: number, centerLng: number, index: number): [number, number] {
  const angle  = ((index * 137.508) % 360) * (Math.PI / 180)
  const radius = 0.001 + (index % 7) * 0.0005
  return [centerLat + radius * Math.sin(angle), centerLng + radius * Math.cos(angle)]
}

interface Complaint {
  id: string; category_en: string; category_ne: string
  severity: number; summary_ne?: string; text?: string
  status: string; created_at: string; escalation_level: number
  lat?: number | null; lng?: number | null
  followup_data?: Record<string, string>
}

interface Ward {
  id: number; name_ne: string; lat: number; lng: number; municipality: string
}

interface Props {
  ward: Ward
  complaints: Complaint[]
  onSelect: (c: Complaint) => void
  selectedId?: string | null
}

export default function FullWardMap({ ward, complaints, onSelect, selectedId }: Props) {
  const mapRef   = useRef<HTMLDivElement>(null)
  const mapInst  = useRef<L.Map | null>(null)
  const markersRef = useRef<Map<string, L.Marker>>(new Map())

  useEffect(() => {
    const el = mapRef.current
    if (!el || mapInst.current) return

    import('leaflet').then((L) => {
      if (!mapRef.current || mapInst.current) return

      const map = L.map(mapRef.current, {
        center: [ward.lat, ward.lng],
        zoom: 15,
        minZoom: 11,
        maxZoom: 19,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // Ward boundary indicator
      L.circle([ward.lat, ward.lng], {
        radius: 700,
        color: '#22c55e',
        weight: 1,
        opacity: 0.25,
        fillColor: '#22c55e',
        fillOpacity: 0.03,
        dashArray: '6 4',
      }).addTo(map)

      mapInst.current = map
    })

    return () => {
      if (mapInst.current) {
        mapInst.current.remove()
        mapInst.current = null
        markersRef.current.clear()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Draw/update markers whenever complaints or selectedId changes
  useEffect(() => {
    const map = mapInst.current
    if (!map) return

    import('leaflet').then((L) => {
      // Remove old markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current.clear()

      complaints.forEach((c, i) => {
        // Use real GPS if available, otherwise scatter around ward center
        const hasGps = c.lat && c.lng
        const [lat, lng] = hasGps
          ? [c.lat!, c.lng!]
          : scatterCoord(ward.lat, ward.lng, i)

        const color   = CAT_COLOR[c.category_en] || CAT_COLOR.Other
        const icon    = CAT_ICON[c.category_en] || '📋'
        const sev     = c.severity || 5
        const isCrit  = sev >= 8
        const isSelected = c.id === selectedId
        const size    = isSelected ? 36 : 28

        const markerIcon = L.divIcon({
          className: '',
          iconSize: [size, size + 10],
          iconAnchor: [size / 2, size + 10],
          html: `
            <div style="position:relative;width:${size}px;height:${size + 10}px;display:flex;flex-direction:column;align-items:center;">
              ${isCrit ? `<div style="position:absolute;top:0;left:50%;transform:translateX(-50%);width:${size}px;height:${size}px;border-radius:50%;background:${color};opacity:0.2;animation:fpulse 2s ease-out infinite;"></div>` : ''}
              <div style="
                width:${size}px;height:${size}px;border-radius:50%;
                background:${color};
                border:${isSelected ? '3px' : '2px'} solid ${isSelected ? 'white' : 'rgba(255,255,255,0.5)'};
                box-shadow:0 0 ${isSelected ? 16 : 8}px ${color}${isSelected ? 'dd' : '66'};
                display:flex;align-items:center;justify-content:center;
                font-size:${size === 36 ? 16 : 13}px;
                position:relative;z-index:2;
                transition:all 0.2s;
              ">${icon}</div>
              <div style="width:2px;height:10px;background:${color};opacity:0.7;"></div>
            </div>
          `,
        })

        const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map)

        // Tooltip on hover — quick preview
        const daysOld = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000)
        const followup = c.followup_data || {}
        const firstFollowup = Object.entries(followup).find(([, v]) => v)

        marker.bindTooltip(`
          <div style="
            background:#0d0d0d;border:1px solid #2a2a2a;border-left:3px solid ${color};
            border-radius:12px;padding:12px 14px;min-width:200px;max-width:260px;
            box-shadow:0 8px 30px rgba(0,0,0,0.8);
          ">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="font-size:18px">${icon}</span>
              <div>
                <div style="color:${color};font-size:11px;font-weight:700;letter-spacing:0.5px;">${CAT_NE[c.category_en] || c.category_ne}</div>
                <div style="color:#525252;font-size:10px;">${daysOld} दिन अघि · गम्भीरता ${sev}/10</div>
              </div>
              ${isCrit ? '<div style="margin-left:auto;background:#dc262620;color:#ef4444;border:1px solid #dc262640;border-radius:6px;padding:2px 6px;font-size:9px;font-weight:700;">🔴 CRITICAL</div>' : ''}
            </div>
            ${c.summary_ne ? `<div style="color:#d4d4d4;font-size:11px;line-height:1.6;margin-bottom:8px;border-top:1px solid #1f1f1f;padding-top:8px;">${c.summary_ne.slice(0, 80)}${c.summary_ne.length > 80 ? '…' : ''}</div>` : ''}
            ${firstFollowup ? `<div style="background:#111;border-radius:8px;padding:6px 8px;margin-top:6px;"><span style="color:#525252;font-size:10px;">${firstFollowup[0].replace(/_/g, ' ')}: </span><span style="color:#a3a3a3;font-size:10px;">${firstFollowup[1]}</span></div>` : ''}
            ${hasGps ? '<div style="color:#22c55e;font-size:9px;margin-top:6px;">📍 सटीक GPS स्थान</div>' : '<div style="color:#525252;font-size:9px;margin-top:6px;">📍 अनुमानित स्थान</div>'}
            <div style="color:#3f3f46;font-size:9px;margin-top:4px;">थिच्नुहोस् थप विवरणका लागि →</div>
          </div>
        `, {
          permanent: false,
          direction: 'top',
          className: 'fw-tooltip',
          opacity: 1,
          offset: [0, -(size + 8)],
        })

        marker.on('click', () => onSelect(c))
        markersRef.current.set(c.id, marker)
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaints, selectedId])

  return (
    <>
      <style>{`
        @keyframes fpulse { 0%{transform:translateX(-50%) scale(0.8);opacity:0.4} 70%{transform:translateX(-50%) scale(2.5);opacity:0} 100%{transform:translateX(-50%) scale(0.8);opacity:0} }
        .fw-tooltip { background:transparent!important;border:none!important;box-shadow:none!important;padding:0!important; }
        .leaflet-tooltip-top:before { display:none!important; }
        .leaflet-control-zoom { border:none!important;background:transparent!important; }
        .leaflet-control-zoom a { background:#111!important;color:#fff!important;border:1px solid #2a2a2a!important;border-radius:8px!important;margin-bottom:4px!important;width:32px!important;height:32px!important;line-height:32px!important; }
        .leaflet-control-zoom a:hover { background:#1f1f1f!important;border-color:#3f3f46!important; }
      `}</style>
      <div ref={mapRef} className="w-full h-full" style={{ background: '#0a0a0a' }} />
    </>
  )
}
