'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

interface LocationPickerProps {
  onSelect: (lat: number, lng: number, label?: string) => void
}

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
  type: string
  address?: { road?: string; suburb?: string; city?: string; state?: string }
}

const PIN_SVG = `
  <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
`

export default function LocationPicker({ onSelect }: LocationPickerProps) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapInst     = useRef<L.Map | null>(null)
  const markerRef   = useRef<L.Marker | null>(null)
  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState<NominatimResult[]>([])
  const [searching,  setSearching]  = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [pinLabel,   setPinLabel]   = useState('')
  const [showDrop,   setShowDrop]   = useState(false)
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef     = useRef<HTMLInputElement>(null)

  // ── Init map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || mapInst.current) return
    import('leaflet').then((L) => {
      if (!mapRef.current || mapInst.current) return
      const map = L.map(mapRef.current, {
        center: [27.7172, 85.3240],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd', maxZoom: 19,
      }).addTo(map)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      map.on('click', (e) => dropPin(L, map, e.latlng.lat, e.latlng.lng))
      mapInst.current = map

      // Fix layout glitch: invalidate after container is fully painted
      setTimeout(() => map.invalidateSize(), 100)
      setTimeout(() => map.invalidateSize(), 400)

      // Also invalidate on any container resize
      const ro = new ResizeObserver(() => {
        mapInst.current?.invalidateSize()
      })
      ro.observe(mapRef.current!)
      // Store ro cleanup on the map element's dataset for cleanup
      ;(map as unknown as { _roCleanup?: () => void })._roCleanup = () => ro.disconnect()
    })
    return () => {
      if (mapInst.current) {
        const m = mapInst.current as unknown as { _roCleanup?: () => void }
        m._roCleanup?.()
        mapInst.current.remove()
        mapInst.current = null
        markerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const dropPin = useCallback((L: typeof import('leaflet'), map: L.Map, lat: number, lng: number, label?: string) => {
    const pinIcon = L.divIcon({
      className: '',
      iconSize: [36, 46],
      iconAnchor: [18, 46],
      html: `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:36px;height:36px;border-radius:50%;background:#16A34A;
          border:3px solid white;box-shadow:0 4px 16px rgba(22,163,74,0.4);
          display:flex;align-items:center;justify-content:center;">${PIN_SVG}</div>
        <div style="width:3px;height:10px;background:#16A34A;border-radius:2px;margin-top:-1px;"></div>
      </div>`,
    })
    if (markerRef.current) markerRef.current.setLatLng([lat, lng])
    else {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map)
      markerRef.current.on('dragend', () => {
        const p = markerRef.current?.getLatLng()
        if (p) { onSelect(p.lat, p.lng); reverseGeocode(p.lat, p.lng) }
      })
    }
    map.setView([lat, lng], 17, { animate: true })
    onSelect(lat, lng, label)
    if (label) setPinLabel(label)
    // Invalidate after pan animation
    setTimeout(() => mapInst.current?.invalidateSize(), 350)
  }, [onSelect]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Nominatim search ──────────────────────────────────────────────
  const search = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setResults([]); setShowDrop(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q + ' Nepal')}&format=json&limit=5&countrycodes=np`,
          { headers: { 'Accept-Language': 'ne,en' } }
        )
        const data = await r.json()
        setResults(data)
        setShowDrop(true)
      } catch { /* ignore */ }
      setSearching(false)
    }, 400)
  }

  const selectResult = (r: NominatimResult) => {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    const label = r.display_name.split(',').slice(0, 2).join(',').trim()
    setQuery(label)
    setShowDrop(false)
    import('leaflet').then(L => {
      if (mapInst.current) dropPin(L, mapInst.current, lat, lng, label)
    })
  }

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'ne,en' } }
      )
      const d = await r.json()
      if (d?.display_name) {
        const label = d.display_name.split(',').slice(0, 2).join(',').trim()
        setPinLabel(label)
        setQuery(label)
      }
    } catch { /* ignore */ }
  }

  const useGPS = () => {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        setGpsLoading(false)
        await import('leaflet').then(L => {
          if (mapInst.current) dropPin(L, mapInst.current, lat, lng)
        })
        reverseGeocode(lat, lng)
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid #E5E7EB', background: '#fff' }}>

      {/* Search bar */}
      <div style={{ position: 'relative', padding: '12px 12px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 12px' }}>
          {/* Search icon SVG */}
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#9CA3AF" strokeWidth={2} style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => search(e.target.value)}
            onFocus={() => results.length > 0 && setShowDrop(true)}
            placeholder="ठाउँ खोज्नुहोस्... (Thamel, Lalitpur...)"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: '#111827', fontFamily: 'Noto Sans Devanagari, sans-serif', minWidth: 0 }}
            autoComplete="off"
          />
          {searching && (
            <div style={{ width: 14, height: 14, border: '2px solid #16A34A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          )}
          {query && !searching && (
            <button onClick={() => { setQuery(''); setResults([]); setShowDrop(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', color: '#9CA3AF', flexShrink: 0 }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {showDrop && results.length > 0 && (
          <div style={{ position: 'absolute', left: 12, right: 12, top: 'calc(100% - 4px)', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', overflow: 'hidden', zIndex: 9999 }}>
            {results.map(r => {
              const parts     = r.display_name.split(',')
              const primary   = parts.slice(0, 2).join(',').trim()
              const secondary = parts.slice(2, 4).join(',').trim()
              return (
                <button key={r.place_id} onClick={() => selectResult(r)}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#16A34A" strokeWidth={2} style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"/>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
                  </svg>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primary}</p>
                    {secondary && <p style={{ fontSize: 11, color: '#9CA3AF', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{secondary}</p>}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* GPS button */}
      <div style={{ padding: '0 12px 10px' }}>
        <button onClick={useGPS} disabled={gpsLoading}
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#16A34A', cursor: gpsLoading ? 'not-allowed' : 'pointer', transition: 'all 0.15s', opacity: gpsLoading ? 0.7 : 1, fontFamily: 'Noto Sans Devanagari, sans-serif' }}
          onMouseEnter={e => { if (!gpsLoading) { (e.currentTarget as HTMLButtonElement).style.background = '#DCFCE7'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#86EFAC' } }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F0FDF4'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#BBF7D0' }}>
          {gpsLoading ? (
            <>
              <div style={{ width: 13, height: 13, border: '2px solid #16A34A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              पत्ता लगाउँदैछ...
            </>
          ) : (
            <>
              {/* GPS/target SVG */}
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="3"/>
                <path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
                <circle cx="12" cy="12" r="9" strokeDasharray="2 4"/>
              </svg>
              मेरो हालको स्थान प्रयोग गर्नुहोस्
            </>
          )}
        </button>
      </div>

      {/* Map container — fixed height, overflow hidden prevents layout bleed */}
      <div style={{ position: 'relative', height: 240, overflow: 'hidden' }}>
        <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />
      </div>

      {/* Pin label */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #F3F4F6', minHeight: 38, display: 'flex', alignItems: 'center', gap: 8 }}>
        {pinLabel ? (
          <>
            <svg width="12" height="12" fill="none" viewBox="0 0 12 12" stroke="#16A34A" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5"/></svg>
            <p style={{ fontSize: 12, color: '#16A34A', margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pinLabel}</p>
          </>
        ) : (
          <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>
            नक्शामा थिचेर वा खोजेर समस्याको ठाउँ राख्नुहोस्
          </p>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .leaflet-control-zoom {
          border: none !important; border-radius: 8px !important;
          overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.10) !important;
          margin: 0 10px 10px 0 !important;
        }
        .leaflet-control-zoom a {
          background: white !important; color: #374151 !important;
          border: none !important; border-bottom: 1px solid #F1F5F9 !important;
          width: 30px !important; height: 30px !important; line-height: 30px !important;
          font-size: 16px !important;
        }
        .leaflet-control-zoom a:hover { background: #F9FAFB !important; }
        .leaflet-attribution-flag { display: none !important; }
        .leaflet-container { background: #F8FAFB; }
      `}</style>
    </div>
  )
}
