'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'

// ── Palette ──────────────────────────────────────────────────────────
const GOV_BLUE = '#0B3C6F'
const CRIMSON  = '#C8102E'

const CAT_NE: Record<string, string> = {
  Education: 'शिक्षा', Infrastructure: 'पूर्वाधार', Health: 'स्वास्थ्य',
  Water: 'खानेपानी', Electricity: 'बिजुली', Corruption: 'भ्रष्टाचार',
  Safety: 'सुरक्षा', Environment: 'वातावरण', Other: 'अन्य',
}

// Severity → heat color
function heatColor(sev: number): string {
  if (sev >= 8) return CRIMSON      // red
  if (sev >= 6) return '#F97316'    // orange
  if (sev >= 4) return '#EAB308'    // yellow
  return '#22C55E'                  // green (low)
}

function scatter(lat: number, lng: number, i: number): [number, number] {
  const angle  = ((i * 137.508) % 360) * (Math.PI / 180)
  const radius = 0.0008 + (i % 6) * 0.0005
  return [lat + radius * Math.sin(angle), lng + radius * Math.cos(angle)]
}

// ── Types ─────────────────────────────────────────────────────────────
interface Complaint {
  id: string; category_en: string; category_ne: string
  severity: number; summary_ne?: string; text?: string
  status: string; created_at: string; escalation_level: number
  lat?: number | null; lng?: number | null
  followup_data?: Record<string, string>
}
interface Ward { id: number; name_ne: string; municipality: string; lat: number; lng: number }
interface Props {
  ward: Ward
  complaints: Complaint[]
  flyTo?: Complaint | null
  selectedId?: string | null
  onSelect: (c: Complaint) => void
}

// ── Spatial clustering ────────────────────────────────────────────────
interface Cluster {
  lat: number; lng: number
  complaints: Complaint[]
  dominant: string
  avgSev: number
}

function buildClusters(complaints: Complaint[], ward: Ward, radius = 0.004): Cluster[] {
  const pts = complaints.map((c, i) => {
    const hasGps = c.lat && c.lng
    const [lat, lng] = hasGps ? [c.lat!, c.lng!] : scatter(ward.lat, ward.lng, i)
    return { lat, lng, c }
  })

  const visited = new Set<number>()
  const clusters: Cluster[] = []

  pts.forEach((pt, idx) => {
    if (visited.has(idx)) return
    const group = pts.filter((other, j) => {
      if (visited.has(j)) return false
      const d = Math.sqrt((pt.lat - other.lat) ** 2 + (pt.lng - other.lng) ** 2)
      return d <= radius
    })
    group.forEach((_, j) => visited.add(pts.indexOf(group[j])))

    const avgLat = group.reduce((s, p) => s + p.lat, 0) / group.length
    const avgLng = group.reduce((s, p) => s + p.lng, 0) / group.length
    const avgSev = group.reduce((s, p) => s + (p.c.severity || 5), 0) / group.length

    // Find dominant category
    const catCount: Record<string, number> = {}
    group.forEach(p => { catCount[p.c.category_en] = (catCount[p.c.category_en] || 0) + 1 })
    const dominant = Object.entries(catCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Other'

    clusters.push({ lat: avgLat, lng: avgLng, complaints: group.map(p => p.c), dominant, avgSev })
  })

  return clusters
}

// ── Layer mode ────────────────────────────────────────────────────────
type LayerMode = 'auto' | 'heatmap' | 'clusters' | 'pins' | 'resolution'

export default function WardMapLight({ ward, complaints, flyTo, selectedId, onSelect }: Props) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapInst     = useRef<L.Map | null>(null)
  const markersRef  = useRef<Map<string, L.Marker>>(new Map())
  const layerRef    = useRef<L.LayerGroup | null>(null)
  const critRef     = useRef<L.LayerGroup | null>(null)
  const [mapReady,  setMapReady]  = useState(false)
  const [zoom,      setZoom]      = useState(15)
  const [layerMode, setLayerMode] = useState<LayerMode>('auto')
  const [clusterInfo, setClusterInfo] = useState<Cluster | null>(null)

  // ── Register upvote global ────────────────────────────────────────
  useEffect(() => {
    ;(window as Window & { sunuwaUpvote?: (id: string, btn: HTMLButtonElement) => void }).sunuwaUpvote =
      async (id: string, btn: HTMLButtonElement) => {
        btn.disabled = true; btn.textContent = '...'
        try {
          const res  = await fetch(`/api/complaints/${id}/upvote`, { method: 'POST' })
          const data = await res.json()
          btn.textContent = `✓ ${data.confirmations_count} जनाले भोग्दैछन्`
          btn.style.background = '#F0FDF4'; btn.style.color = '#16A34A'
        } catch {
          btn.disabled = false; btn.textContent = 'म पनि यो भोग्दैछु'
        }
      }
    return () => { delete (window as Window & { sunuwaUpvote?: unknown }).sunuwaUpvote }
  }, [])

  // ── Init map once ─────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return
    import('leaflet').then((L) => {
      if (!mapRef.current || mapInst.current) return
      const map = L.map(mapRef.current, {
        center: [ward.lat || 27.7172, ward.lng || 85.3240],
        zoom: 14,
        zoomControl: false,
        attributionControl: true,
      })
      // CartoDB Positron — clean government-grade basemap
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://carto.com">CARTO</a>',
        subdomains: 'abcd', maxZoom: 20,
      }).addTo(map)
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Layer groups
      layerRef.current = L.layerGroup().addTo(map)
      critRef.current  = L.layerGroup().addTo(map)

      // Ward boundary
      const query = `${ward.name_ne} ${ward.municipality} Nepal`
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=geojson&polygon_geojson=1&limit=3`,
        { headers: { 'Accept-Language': 'ne,en' } })
        .then(r => r.json())
        .then((geo: { features?: { geometry: { type: string } }[] }) => {
          const feature = geo.features?.find(f =>
            f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
          )
          if (feature) {
            L.geoJSON(feature as unknown as Parameters<typeof L.geoJSON>[0], {
              style: { color: GOV_BLUE, weight: 2, opacity: 0.5, fillColor: GOV_BLUE, fillOpacity: 0.04 },
            }).addTo(map)
          }
        })
        .catch(() => {})

      map.on('zoomend', () => setZoom(map.getZoom()))
      mapInst.current = map
      setMapReady(true)
    })
    return () => { mapInst.current?.remove(); mapInst.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fly to selected complaint ─────────────────────────────────────
  useEffect(() => {
    if (!flyTo || !mapInst.current) return
    const lat = flyTo.lat || ward.lat
    const lng = flyTo.lng || ward.lng
    mapInst.current.flyTo([lat, lng], 18, { animate: true, duration: 0.9 })
    const marker = markersRef.current.get(flyTo.id)
    if (marker) setTimeout(() => marker.openPopup(), 950)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyTo])

  // ── Determine effective render mode ──────────────────────────────
  const effectiveMode = useCallback((): 'heatmap' | 'clusters' | 'pins' | 'resolution' => {
    if (layerMode !== 'auto') return layerMode as 'heatmap' | 'clusters' | 'pins' | 'resolution'
    if (zoom < 14)  return 'heatmap'
    if (zoom < 16)  return 'clusters'
    return 'pins'
  }, [layerMode, zoom])

  // ── Render layers ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInst.current
    const layer = layerRef.current
    const critLayer = critRef.current
    if (!map || !layer || !critLayer) return

    import('leaflet').then((L) => {
      // Clear dynamic layers
      layer.clearLayers()
      critLayer.clearLayers()
      markersRef.current.clear()
      setClusterInfo(null)

      const mode = effectiveMode()
      const withGps = complaints.map((c, i) => {
        const hasGps = c.lat && c.lng
        const [lat, lng] = hasGps ? [c.lat!, c.lng!] : scatter(ward.lat, ward.lng, i)
        return { c, lat, lng, hasGps }
      })

      // ── 1. CRITICAL pulsing zones (always visible) ─────────────
      withGps.filter(p => (p.c.severity || 5) >= 8).forEach(({ c, lat, lng }) => {
        // Outer pulse ring
        for (let ring = 0; ring < 3; ring++) {
          L.circle([lat, lng], {
            radius: 60 + ring * 40,
            color: CRIMSON,
            fillColor: CRIMSON,
            fillOpacity: 0.06 - ring * 0.015,
            weight: ring === 0 ? 1.5 : 0,
            opacity: 0.5 - ring * 0.1,
            className: 'critical-ring',
          }).addTo(critLayer)
        }
      })

      // ── 2. HEATMAP mode ────────────────────────────────────────
      if (mode === 'heatmap') {
        withGps.forEach(({ c, lat, lng }) => {
          const sev = c.severity || 5
          const col = heatColor(sev)
          // Large translucent blob
          L.circle([lat, lng], {
            radius: 120 + sev * 20,
            color: 'transparent',
            fillColor: col,
            fillOpacity: 0.10 + sev * 0.012,
            weight: 0,
          }).addTo(layer)
          // Brighter inner core
          L.circle([lat, lng], {
            radius: 30 + sev * 5,
            color: col,
            fillColor: col,
            fillOpacity: 0.22,
            weight: 0,
          }).addTo(layer)
        })
        // Ward centroid label
        L.marker([ward.lat, ward.lng], {
          icon: L.divIcon({
            className: '',
            iconSize: [120, 28],
            iconAnchor: [60, 14],
            html: `<div style="
              background:rgba(11,60,111,0.85);color:white;
              font-size:10px;font-weight:700;
              padding:3px 10px;letter-spacing:0.1em;
              text-transform:uppercase;border-left:3px solid ${CRIMSON};
              white-space:nowrap;
            ">${ward.name_ne} · ${complaints.length} COMPLAINTS</div>`,
          }),
          interactive: false,
        }).addTo(layer)
        return
      }

      // ── 3. CLUSTER mode ────────────────────────────────────────
      if (mode === 'clusters') {
        const clusterRadius = zoom < 15 ? 0.006 : 0.003
        const clusters = buildClusters(complaints, ward, clusterRadius)

        clusters.forEach(cluster => {
          const count  = cluster.complaints.length
          const sev    = Math.round(cluster.avgSev)
          const col    = heatColor(cluster.avgSev)
          const size   = Math.min(72, 36 + count * 2)
          const catNe  = CAT_NE[cluster.dominant] || cluster.dominant

          const icon = L.divIcon({
            className: '',
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
            html: `
              <div style="
                width:${size}px;height:${size}px;
                border-radius:50%;
                background:${col}18;
                border:2px solid ${col};
                display:flex;flex-direction:column;
                align-items:center;justify-content:center;
                cursor:pointer;
                box-shadow:0 2px 12px ${col}40;
                position:relative;
              ">
                <span style="font-size:${size > 50 ? 18 : 14}px;font-weight:800;color:${col};line-height:1;">${count}</span>
                <span style="font-size:8px;color:${col};opacity:0.75;margin-top:1px;font-family:'Noto Sans Devanagari',sans-serif;line-height:1;">${catNe}</span>
                <div style="
                  position:absolute;top:-2px;right:-2px;
                  background:${col};color:white;
                  border-radius:999px;padding:1px 4px;
                  font-size:8px;font-weight:700;
                ">sev ${sev}</div>
              </div>
            `,
          })

          L.marker([cluster.lat, cluster.lng], { icon })
            .on('click', () => setClusterInfo(cluster))
            .addTo(layer)
        })
        return
      }

      // ── 4. RESOLUTION mode ─────────────────────────────────────
      if (mode === 'resolution') {
        withGps.forEach(({ c, lat, lng }) => {
          const resolved = c.status === 'resolved'
          L.circle([lat, lng], {
            radius: resolved ? 80 : 40,
            color: resolved ? '#16A34A' : '#6B7280',
            fillColor: resolved ? '#16A34A' : '#9CA3AF',
            fillOpacity: resolved ? 0.25 : 0.08,
            weight: resolved ? 2 : 1,
            opacity: resolved ? 0.8 : 0.3,
          }).addTo(layer)
        })
        // Summary label
        const resolvedCount = complaints.filter(c => c.status === 'resolved').length
        const rate = complaints.length ? Math.round(resolvedCount / complaints.length * 100) : 0
        L.marker([ward.lat + 0.003, ward.lng], {
          icon: L.divIcon({
            className: '',
            iconSize: [160, 36],
            iconAnchor: [80, 18],
            html: `<div style="
              background:rgba(22,163,74,0.9);color:white;
              font-size:11px;font-weight:700;
              padding:5px 14px;letter-spacing:0.05em;
              border-left:3px solid #BBF7D0;white-space:nowrap;
            ">✓ ${resolvedCount}/${complaints.length} Resolved · ${rate}%</div>`,
          }),
          interactive: false,
        }).addTo(layer)
        return
      }

      // ── 5. INDIVIDUAL PINS mode ────────────────────────────────
      withGps.forEach(({ c, lat, lng, hasGps }) => {
        const sev  = c.severity || 5
        const col  = sev >= 8 ? CRIMSON : sev >= 5 ? '#D97706' : GOV_BLUE
        const isSelected = c.id === selectedId
        const size = isSelected ? 14 : 10
        const daysOld = Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86_400_000)

        const markerIcon = L.divIcon({
          className: '',
          iconSize:  [size, size],
          iconAnchor:[size / 2, size / 2],
          html: `<div style="
            width:${size}px;height:${size}px;
            background:${col};
            border:${isSelected ? 2 : 1.5}px solid white;
            box-shadow:0 1px 6px ${col}60${isSelected ? ',0 0 0 3px ' + col + '40' : ''};
            border-radius:1px;
          "></div>`,
        })

        const catNe = CAT_NE[c.category_en] || c.category_ne
        const popup = L.popup({
          className: 'sunuwa-popup',
          maxWidth: 240, minWidth: 200,
          offset: [0, -8],
          closeButton: true, autoPan: true,
        }).setContent(`
          <div style="font-family:system-ui,'Noto Sans Devanagari',sans-serif;font-size:12px;">
            <div style="border-left:3px solid ${col};padding-left:8px;margin-bottom:8px;">
              <div style="font-weight:700;color:${col};font-size:11px;letter-spacing:0.05em;text-transform:uppercase;">
                ${catNe}
              </div>
              <div style="color:#6B7280;font-size:10px;margin-top:2px;font-family:monospace;">
                ${daysOld}d ago · SEV ${sev}/10 · ${c.status.toUpperCase()}
              </div>
            </div>
            ${c.summary_ne ? `<p style="font-size:11px;color:#374151;line-height:1.6;margin:0 0 8px 0;font-family:'Noto Sans Devanagari',sans-serif;">
              ${c.summary_ne.slice(0, 90)}${c.summary_ne.length > 90 ? '…' : ''}
            </p>` : ''}
            <div style="border-top:1px solid #F3F4F6;padding-top:8px;display:flex;gap:6px;align-items:center;">
              <div style="flex:1;height:3px;background:#F3F4F6;">
                <div style="height:100%;width:${sev * 10}%;background:${col};"></div>
              </div>
              ${hasGps ? `<span style="font-size:9px;color:#16A34A;font-weight:600;">● GPS</span>` : `<span style="font-size:9px;color:#9CA3AF;">~ approx</span>`}
            </div>
            <button onclick="window.sunuwaUpvote('${c.id}',this)"
              style="margin-top:8px;width:100%;padding:6px 0;border:1px solid #DBEAFE;
              background:#EFF6FF;color:#1D4ED8;font-size:10px;font-weight:600;
              font-family:'Noto Sans Devanagari',sans-serif;cursor:pointer;">
              म पनि यो भोग्दैछु
            </button>
          </div>
        `)

        const marker = L.marker([lat, lng], { icon: markerIcon })
          .addTo(layer).bindPopup(popup)
        marker.on('click', () => onSelect(c))
        markersRef.current.set(c.id, marker)
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaints, selectedId, mapReady, zoom, layerMode])

  const mode = effectiveMode()

  return (
    <>
      <style>{`
        @keyframes critpulse {
          0%   { opacity:0.6; }
          50%  { opacity:0.15; }
          100% { opacity:0.6; }
        }
        .critical-ring { animation: critpulse 2s ease-in-out infinite; }
        .sunuwa-popup .leaflet-popup-content-wrapper {
          border-radius:0 !important;
          border:1px solid #E5E7EB !important;
          box-shadow:0 8px 32px rgba(0,0,0,0.14) !important;
          padding:12px 14px !important;
        }
        .sunuwa-popup .leaflet-popup-content { margin:0 !important; }
        .sunuwa-popup .leaflet-popup-tip { background:white !important; }
        .leaflet-control-zoom {
          border:none !important; border-radius:0 !important; overflow:hidden;
          box-shadow:0 2px 8px rgba(0,0,0,0.12) !important;
        }
        .leaflet-control-zoom a {
          background:white !important; color:#111827 !important;
          border:none !important; border-bottom:1px solid #F3F4F6 !important;
          width:32px !important; height:32px !important;
          line-height:32px !important; font-size:14px !important;
        }
        .leaflet-control-zoom a:hover { background:${GOV_BLUE} !important; color:white !important; }
        .leaflet-attribution-flag { display:none !important; }
        .leaflet-bottom.leaflet-right { margin-bottom:8px; margin-right:8px; }
      `}</style>

      <div className="w-full h-full relative">
        <div ref={mapRef} className="w-full h-full" />

        {/* ── Layer toggle controls ────────────────────────────── */}
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1">
          {([
            { key: 'auto',       label: 'AUTO',       title: 'Auto (zoom-based)' },
            { key: 'heatmap',    label: 'HEAT',       title: 'Heatmap view' },
            { key: 'clusters',   label: 'CLUSTERS',   title: 'Cluster view' },
            { key: 'pins',       label: 'COMPLAINTS', title: 'Individual pins' },
            { key: 'resolution', label: 'RESOLVED',   title: 'Resolution layer' },
          ] as { key: LayerMode; label: string; title: string }[]).map(btn => (
            <button
              key={btn.key}
              title={btn.title}
              onClick={() => setLayerMode(btn.key)}
              className="text-[9px] font-bold tracking-wider px-2.5 py-1.5 transition-all text-right"
              style={{
                background:   layerMode === btn.key ? GOV_BLUE : 'rgba(255,255,255,0.92)',
                color:        layerMode === btn.key ? 'white'   : '#374151',
                borderLeft:   `3px solid ${layerMode === btn.key ? CRIMSON : '#D1D5DB'}`,
                boxShadow:    '0 1px 4px rgba(0,0,0,0.12)',
              }}>
              {btn.label}
            </button>
          ))}
        </div>

        {/* ── Zoom / mode indicator ────────────────────────────── */}
        <div className="absolute top-3 left-3 z-[1000]">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] font-bold text-white uppercase tracking-widest"
            style={{ background: 'rgba(11,60,111,0.88)', borderLeft: `3px solid ${CRIMSON}` }}>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            {mode === 'heatmap'    && 'Strategic View — Density Heatmap'}
            {mode === 'clusters'   && 'Tactical View — Complaint Clusters'}
            {mode === 'pins'       && 'Investigation View — Individual Complaints'}
            {mode === 'resolution' && 'Resolution Layer — Government Impact'}
          </div>
          {mode === 'heatmap' && (
            <div className="flex items-center gap-3 mt-1.5 px-2.5 py-1.5 text-[9px] font-bold"
              style={{ background: 'rgba(255,255,255,0.94)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              {[
                { col: CRIMSON,    label: 'Critical' },
                { col: '#F97316',  label: 'High' },
                { col: '#EAB308',  label: 'Medium' },
                { col: '#22C55E',  label: 'Low' },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1" style={{ color: '#374151' }}>
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: l.col }} />
                  {l.label}
                </span>
              ))}
            </div>
          )}
          {mode === 'clusters' && (
            <div className="px-2.5 py-1 mt-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-wider"
              style={{ background: 'rgba(255,255,255,0.94)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              Zoom in to investigate clusters
            </div>
          )}
          {mode === 'pins' && (
            <div className="flex items-center gap-3 mt-1.5 px-2.5 py-1.5 text-[9px] font-bold"
              style={{ background: 'rgba(255,255,255,0.94)', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }}>
              {[
                { col: CRIMSON,   label: 'Critical 8+' },
                { col: '#D97706', label: 'High 5-7' },
                { col: GOV_BLUE,  label: 'Low 1-4' },
              ].map(l => (
                <span key={l.label} className="flex items-center gap-1" style={{ color: '#374151' }}>
                  <span className="w-2 h-2 inline-block" style={{ background: l.col }} />
                  {l.label}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── Cluster investigation panel (floats over map) ─────── */}
        {clusterInfo && (
          <div
            className="absolute bottom-10 left-3 z-[1000] w-64 border border-gray-200 shadow-xl"
            style={{ background: 'white', borderLeft: `4px solid ${heatColor(clusterInfo.avgSev)}` }}>
            <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between"
              style={{ background: heatColor(clusterInfo.avgSev) + '12' }}>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cluster Analysis</p>
                <p className="text-sm font-bold" style={{ color: heatColor(clusterInfo.avgSev), fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                  {CAT_NE[clusterInfo.dominant] || clusterInfo.dominant}
                </p>
              </div>
              <button onClick={() => setClusterInfo(null)}
                className="text-gray-400 hover:text-gray-700 transition-colors text-lg leading-none ml-2">×</button>
            </div>
            <div className="p-3 space-y-2">
              {[
                { label: 'Complaints',        value: clusterInfo.complaints.length.toString() },
                { label: 'Avg Severity',      value: `${clusterInfo.avgSev.toFixed(1)}/10` },
                { label: 'Dominant Issue',    value: CAT_NE[clusterInfo.dominant] || clusterInfo.dominant },
                { label: 'Unresolved',        value: clusterInfo.complaints.filter(c => c.status !== 'resolved').length.toString() },
                { label: 'Escalation Risk',   value: clusterInfo.avgSev >= 7 ? 'HIGH' : clusterInfo.avgSev >= 5 ? 'MEDIUM' : 'LOW' },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">{r.label}</span>
                  <span className="text-xs font-bold" style={{
                    color: r.label === 'Escalation Risk'
                      ? (r.value === 'HIGH' ? CRIMSON : r.value === 'MEDIUM' ? '#D97706' : '#16A34A')
                      : r.label === 'Avg Severity'
                        ? heatColor(parseFloat(r.value))
                        : '#111827',
                    fontFamily: 'Noto Sans Devanagari, sans-serif'
                  }}>{r.value}</span>
                </div>
              ))}
              {/* Category breakdown */}
              {(() => {
                const catMap: Record<string, number> = {}
                clusterInfo.complaints.forEach(c => { catMap[c.category_en] = (catMap[c.category_en] || 0) + 1 })
                return Object.entries(catMap).sort((a,b) => b[1]-a[1]).slice(0, 4).map(([cat, n]) => (
                  <div key={cat} className="flex items-center gap-2 mt-1">
                    <div className="flex-1 text-[10px] text-gray-600" style={{ fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
                      {CAT_NE[cat] || cat}
                    </div>
                    <div className="w-20 h-1.5 bg-gray-100">
                      <div className="h-full" style={{ width: `${n / clusterInfo.complaints.length * 100}%`, background: GOV_BLUE }} />
                    </div>
                    <span className="text-[10px] font-mono font-bold text-gray-500 w-4 text-right">{n}</span>
                  </div>
                ))
              })()}
              <button
                onClick={() => {
                  setLayerMode('pins')
                  if (mapInst.current) mapInst.current.flyTo([clusterInfo.lat, clusterInfo.lng], 18, { duration: 0.8 })
                  clusterInfo.complaints.forEach(c => onSelect(c))
                  setClusterInfo(null)
                }}
                className="w-full text-[10px] font-bold py-2 mt-1 transition-all text-white uppercase tracking-wider"
                style={{ background: GOV_BLUE }}>
                Investigate → Open Inspector
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
