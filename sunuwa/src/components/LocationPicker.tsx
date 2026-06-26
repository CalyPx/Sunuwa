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
}

const PIN_SVG = `<svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>`

const MAP_HEIGHT = 260

export default function LocationPicker({ onSelect }: LocationPickerProps) {
  const wrapRef    = useRef<HTMLDivElement>(null)   // stable wrapper with fixed pixel size
  const mapRef     = useRef<HTMLDivElement>(null)   // Leaflet mounts here
  const mapInst    = useRef<L.Map | null>(null)
  const markerRef  = useRef<L.Marker | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  const [query,      setQuery]      = useState('')
  const [results,    setResults]    = useState<NominatimResult[]>([])
  const [searching,  setSearching]  = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [pinLabel,   setPinLabel]   = useState('')
  const [showDrop,   setShowDrop]   = useState(false)

  // ── Init Leaflet map ────────────────────────────────────────────────
  useEffect(() => {
    let destroyed = false

    async function init() {
      if (!mapRef.current || mapInst.current) return

      // Leaflet CSS must be injected before L.map() runs.
      // We do it here (once) because the component is always ssr:false.
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link')
        link.id   = 'leaflet-css'
        link.rel  = 'stylesheet'
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
        link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY='
        link.crossOrigin = ''
        document.head.appendChild(link)
        // Wait for CSS to load so tile-pane positioning is correct
        await new Promise<void>(res => { link.onload = () => res(); link.onerror = () => res() })
      }

      if (destroyed || !mapRef.current || mapInst.current) return

      // Wait for the container to have a real rendered width.
      // If the form/page is still animating, offsetWidth may be 0.
      let tries = 0
      while (mapRef.current.offsetWidth === 0 && tries < 20) {
        await new Promise(r => setTimeout(r, 50))
        tries++
      }
      if (destroyed || !mapRef.current || mapInst.current) return

      const L = (await import('leaflet')).default ?? (await import('leaflet'))
      if (destroyed || !mapRef.current || mapInst.current) return

      // Set concrete pixel size — never use % or 'auto' before L.map()
      const w = mapRef.current.offsetWidth || wrapRef.current?.offsetWidth || 600
      mapRef.current.style.width  = w + 'px'
      mapRef.current.style.height = MAP_HEIGHT + 'px'

      const map = L.map(mapRef.current, {
        center: [27.7172, 85.3240],
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true,   // faster tile rendering
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
        // tileSize and detectRetina help prevent misaligned tiles
        detectRetina: true,
      }).addTo(map)

      L.control.zoom({ position: 'bottomright' }).addTo(map)
      map.on('click', e => handleMapClick(L, map, e.latlng.lat, e.latlng.lng))
      mapInst.current = map

      // whenReady is the correct Leaflet hook — fires after full internal init
      map.whenReady(() => {
        if (!destroyed) map.invalidateSize({ animate: false })
      })

      // Resize observer on wrapper — handles any parent layout changes
      const ro = new ResizeObserver(() => {
        if (destroyed || !mapRef.current || !mapInst.current) return
        const newW = wrapRef.current?.offsetWidth ?? mapRef.current.offsetWidth
        if (newW > 0) {
          mapRef.current.style.width = newW + 'px'
          mapInst.current.invalidateSize({ animate: false })
        }
      })
      if (wrapRef.current) ro.observe(wrapRef.current)

      const onVis = () => {
        if (document.visibilityState === 'visible' && !destroyed)
          mapInst.current?.invalidateSize({ animate: false })
      }
      document.addEventListener('visibilitychange', onVis)

      // Store cleanups on the map instance
      ;(map as unknown as Record<string, unknown>)._cleanup = () => {
        ro.disconnect()
        document.removeEventListener('visibilitychange', onVis)
      }
    }

    init()

    return () => {
      destroyed = true
      if (mapInst.current) {
        ;(mapInst.current as unknown as Record<string, unknown>)._cleanup?.()
        ;(mapInst.current as unknown as { _cleanup?: () => void })._cleanup?.()
        mapInst.current.remove()
        mapInst.current = null
        markerRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Drop / move pin ─────────────────────────────────────────────────
  const handleMapClick = useCallback((L: typeof import('leaflet'), map: L.Map, lat: number, lng: number, label?: string) => {
    const pinIcon = L.divIcon({
      className: '',
      iconSize: [36, 46],
      iconAnchor: [18, 46],
      html: `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="width:36px;height:36px;border-radius:50%;background:#16A34A;border:3px solid white;box-shadow:0 4px 16px rgba(22,163,74,0.4);display:flex;align-items:center;justify-content:center;">${PIN_SVG}</div>
        <div style="width:3px;height:10px;background:#16A34A;border-radius:2px;margin-top:-1px;"></div>
      </div>`,
    })
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
    } else {
      markerRef.current = L.marker([lat, lng], { icon: pinIcon, draggable: true }).addTo(map)
      markerRef.current.on('dragend', () => {
        const p = markerRef.current?.getLatLng()
        if (p) { onSelect(p.lat, p.lng); reverseGeocode(p.lat, p.lng) }
      })
    }
    map.setView([lat, lng], 17, { animate: true })
    onSelect(lat, lng, label)
    if (label) setPinLabel(label)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSelect])

  // ── Geocoding ────────────────────────────────────────────────────────
  const search = (q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.trim().length < 2) { setResults([]); setShowDrop(false); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const r = await fetch(`/api/geocode?type=search&q=${encodeURIComponent(q)}`)
        if (r.ok) {
          const data = await r.json()
          setResults(Array.isArray(data) ? data : [])
          setShowDrop(true)
        }
      } catch { /* silent */ }
      setSearching(false)
    }, 500)
  }

  const selectResult = (r: NominatimResult) => {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    const label = r.display_name.split(',').slice(0, 2).join(',').trim()
    setQuery(label)
    setShowDrop(false)
    import('leaflet').then(L => {
      if (mapInst.current) handleMapClick(L, mapInst.current, lat, lng, label)
    })
  }

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const r = await fetch(`/api/geocode?type=reverse&lat=${lat}&lon=${lng}`)
      if (!r.ok) return
      const d = await r.json()
      if (d?.display_name) {
        const label = d.display_name.split(',').slice(0, 2).join(',').trim()
        setPinLabel(label)
        setQuery(label)
      }
    } catch { /* silent */ }
  }

  const useGPS = () => {
    if (!navigator.geolocation) return
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      async ({ coords: { latitude: lat, longitude: lng } }) => {
        setGpsLoading(false)
        import('leaflet').then(L => {
          if (mapInst.current) handleMapClick(L, mapInst.current, lat, lng)
        })
        reverseGeocode(lat, lng)
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 8000 }
    )
  }

  return (
    <div style={{ border: '1px solid #E5E7EB', borderRadius: 12, background: '#fff', fontFamily: 'system-ui, sans-serif' }}>

      {/* Search bar */}
      <div style={{ position: 'relative', padding: '12px 12px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 10, padding: '8px 12px' }}>
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
          {searching && <div style={{ width: 14, height: 14, border: '2px solid #16A34A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'lp-spin 0.8s linear infinite', flexShrink: 0 }} />}
          {query && !searching && (
            <button onClick={() => { setQuery(''); setResults([]); setShowDrop(false) }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#9CA3AF' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {showDrop && results.length > 0 && (
          <div style={{ position: 'absolute', left: 12, right: 12, top: 'calc(100% - 4px)', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', overflow: 'hidden', zIndex: 9999 }}>
            {results.map(r => {
              const parts = r.display_name.split(',')
              const primary = parts.slice(0, 2).join(',').trim()
              const secondary = parts.slice(2, 4).join(',').trim()
              return (
                <button key={r.place_id} onClick={() => selectResult(r)}
                  style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', borderBottom: '1px solid #F3F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F9FAFB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#16A34A" strokeWidth={2} style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"/>
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
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#16A34A', cursor: gpsLoading ? 'not-allowed' : 'pointer', opacity: gpsLoading ? 0.7 : 1, fontFamily: 'Noto Sans Devanagari, sans-serif' }}
          onMouseEnter={e => { if (!gpsLoading) { (e.currentTarget as HTMLButtonElement).style.background = '#DCFCE7' } }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F0FDF4' }}>
          {gpsLoading
            ? <><div style={{ width: 13, height: 13, border: '2px solid #16A34A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'lp-spin 0.8s linear infinite' }} />पत्ता लगाउँदैछ...</>
            : <><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="3"/><path strokeLinecap="round" d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="9" strokeDasharray="2 4"/></svg>मेरो हालको स्थान प्रयोग गर्नुहोस्</>
          }
        </button>
      </div>

      {/* Map wrapper — stable reference div that ResizeObserver watches */}
      <div ref={wrapRef} style={{ width: '100%' }}>
        {/* Leaflet mounts into this div — NO overflow:hidden here, Leaflet manages its own */}
        <div ref={mapRef} />
      </div>

      {/* Pin label */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid #F3F4F6', minHeight: 38, display: 'flex', alignItems: 'center', gap: 8 }}>
        {pinLabel
          ? <><svg width="12" height="12" fill="none" viewBox="0 0 12 12" stroke="#16A34A" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5"/></svg><p style={{ fontSize: 12, color: '#16A34A', margin: 0, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pinLabel}</p></>
          : <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, fontFamily: 'Noto Sans Devanagari, sans-serif' }}>नक्शामा थिचेर वा खोजेर समस्याको ठाउँ राख्नुहोस्</p>
        }
      </div>

      <style>{`
        @keyframes lp-spin { to { transform: rotate(360deg); } }
        .leaflet-container { background: #F8FAFB !important; }
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
      `}</style>
    </div>
  )
}
