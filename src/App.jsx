import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  INSTANCES,
  ENGINE_LABELS,
  ENGINE_COLORS,
  COLLECTION_DESCRIPTIONS,
  BUILD_VERSION,
  SERVICE_SLOTS,
  DEMO_NAV_LINKS,
  sanitizeDemoIndex,
  encodeDemoIndexPathSegment,
} from './config'

import { createFlapjackClient, createAlgoliaClient, createMeilisearchClient, createTypesenseClient, fetchTypesenseQueryFields } from './clients'
import { warmupAllServices } from './warmup'
import { buildFilterString } from './utils'
import { KNOWN_COLLECTIONS } from './known-collections'
import { resolveSlots as _resolveSlots } from './slot-resolver'
import { ServiceColumn } from './components/ServiceColumn'
import { LatencyChart } from './components/LatencyChart'
import { FiltersPanel } from './components/FiltersPanel'

const pageIsSecure = typeof window !== 'undefined' && window.location.protocol === 'https:'

function resolveSlots(slots, discoveredCollections, indexName, region, devMode) {
  return _resolveSlots(slots, INSTANCES, discoveredCollections, indexName, region, devMode, pageIsSecure)
}

export default function App() {
  const [discoveredCollections] = useState(KNOWN_COLLECTIONS)
  const discoveryDone = true
  const [indexName, setIndexName] = useState(() => {
    const param = new URLSearchParams(window.location.search).get('index')
    return sanitizeDemoIndex(param, Object.keys(KNOWN_COLLECTIONS))
  })
  const [region, setRegion] = useState('us-west-1')
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [customFilter, setCustomFilter] = useState('')
  const [facetAttributes, setFacetAttributes] = useState([])
  const [selectedFacets, setSelectedFacets] = useState({})
  const [sortBy, setSortBy] = useState('')
  const [facetValues, setFacetValues] = useState({})
  const [devMode, setDevMode] = useState(() => new URLSearchParams(window.location.search).has('dev'))
  const [oneResultOnly, setOneResultOnly] = useState(false)
  const [debounceOn, setDebounceOn] = useState(true)
  const debounceTimerRef = useRef(null)
  const debounceStartRef = useRef(null)
  const [debounceCountdown, setDebounceCountdown] = useState(0)
  const keystrokeTimeRef = useRef(null)
  if (typeof window !== 'undefined') window.__keystrokeTime = keystrokeTimeRef
  const [metrics, setMetrics] = useState({})
  const [clients, setClients] = useState({})
  // const [fjLocalBuildProfile, setFjLocalBuildProfile] = useState(null)
  
  const debounceOnRef = useRef(debounceOn)
  debounceOnRef.current = debounceOn
  const debouncedQueryRef = useRef(debouncedQuery)
  debouncedQueryRef.current = debouncedQuery
  const indexNameRef = useRef(indexName)
  indexNameRef.current = indexName
  const metricsCallbacksRef = useRef({})
  const metricsLogRef = useRef([])
  const appMountTime = useRef(performance.now())
  // Pre-warm TLS connections to remote services on mount (eliminates first-keystroke spike)
  useEffect(() => { warmupAllServices() }, [])
  const createMetricsCallback = useCallback((instanceId) => {
    if (!metricsCallbacksRef.current[instanceId]) {
      metricsCallbacksRef.current[instanceId] = (m) => {
        const ks = keystrokeTimeRef.current
        const k2r = ks ? Math.round(performance.now() - ks) : null
        const entry = { type: 'query', id: instanceId, latency: m.latency, nbHits: m.nbHits, t: Math.round(performance.now() - appMountTime.current), k2r, db: debounceOnRef.current, q: debouncedQueryRef.current, col: indexNameRef.current }
        metricsLogRef.current.push(entry)
        if (metricsLogRef.current.length > 100) metricsLogRef.current.shift()
        setMetrics(prev => ({ ...prev, [instanceId]: m }))
      }
    }
    return metricsCallbacksRef.current[instanceId]
  }, [])





  // Disabled: localhost health check triggers browser "Local Network Access" permission prompt
  // useEffect(() => {
  //   if (!devMode) return
  //   setFjLocalBuildProfile(null)
  //   fetch('http://localhost:7700/health', { targetAddressSpace: 'loopback' })
  //     .then(r => r.json())
  //     .then(d => setFjLocalBuildProfile(d.build_profile || 'unknown'))
  //     .catch(() => setFjLocalBuildProfile(null))
  // }, [devMode])

  const resolvedSlots = useMemo(() => {
    const slots = resolveSlots(SERVICE_SLOTS, discoveredCollections, indexName, region, devMode)
    console.log('Resolved slots:', slots.map(s => ({ id: s.slotId, inst: s.instance?.id, reason: s.reason })))
    return slots
  }, [discoveredCollections, indexName, region, devMode])

  const activeInstances = useMemo(() => {
    return resolvedSlots.filter(s => s.instance).map(s => s.instance)
  }, [resolvedSlots])

  const collectionNames = useMemo(() => {
    return Object.keys(discoveredCollections).sort()
  }, [discoveredCollections])

  useEffect(() => {
    if (!discoveryDone || collectionNames.length === 0) return
    if (!discoveredCollections[indexName]) {
      const fallback = collectionNames.find(n => !n.startsWith('test_')) || collectionNames[0]
      console.log(`[AUTO] "${indexName}" not found, falling back to "${fallback}"`)
      setIndexName(fallback)
    }
  }, [discoveryDone, discoveredCollections, indexName, collectionNames])

  const [facetsReady, setFacetsReady] = useState(false)
  const lastFacetIndexRef = useRef(null)
  useEffect(() => {
    if (!indexName || !discoveredCollections[indexName]) return
    const fjCandidates = activeInstances.filter(i => i.engine === 'flapjack')
    if (fjCandidates.length === 0) {
      if (lastFacetIndexRef.current !== null) {
        setFacetAttributes([])
        setFacetValues({})
        lastFacetIndexRef.current = null
      }
      return
    }
    setFacetsReady(false)
    if (lastFacetIndexRef.current === indexName) { setFacetsReady(true); return }
    const ordered = [
      ...fjCandidates.filter(i => i.region === 'local'),
      ...fjCandidates.filter(i => i.region !== 'local'),
    ]
    let cancelled = false
    async function fetchFacetSettings() {
      const ft0 = performance.now()
      const encodedIndexName = encodeDemoIndexPathSegment(indexName)
      for (const fjInstance of ordered) {
        try {
          const res = await fetch(`${fjInstance.host}/1/indexes/${encodedIndexName}/settings`, {
            headers: { 'x-algolia-api-key': fjInstance.auth.apiKey, 'x-algolia-application-id': fjInstance.auth.appId }
          })
          if (!res.ok) continue
          if (cancelled) return
          const settings = await res.json()
          const raw = settings.attributesForFaceting || []
          const attrs = raw.map(a => a.replace(/^(filterOnly|searchable)\((.+)\)$/, '$2'))
          if (attrs.length > 0) {
            const facetRes = await fetch(`${fjInstance.host}/1/indexes/${encodedIndexName}/query`, {
              method: 'POST',
              headers: { 'x-algolia-api-key': fjInstance.auth.apiKey, 'x-algolia-application-id': fjInstance.auth.appId, 'content-type': 'application/json' },
              body: JSON.stringify({ query: '', facets: attrs, hitsPerPage: 0 })
            })
            if (cancelled) return
            const facetData = await facetRes.json()
            setFacetAttributes(attrs)
            setSelectedFacets({})
            setFacetValues(facetData.facets || {})
          } else {
            setFacetAttributes([])
            setSelectedFacets({})
            setFacetValues({})
          }
          lastFacetIndexRef.current = indexName
          window.__facetFetchMs = Math.round(performance.now() - ft0)
          setFacetsReady(true)
          return
        } catch {}
      }
      if (!cancelled) {
        setFacetAttributes([])
        setFacetValues({})
        lastFacetIndexRef.current = indexName
        setFacetsReady(true)
      }
    }
    fetchFacetSettings()
    return () => { cancelled = true }
  }, [indexName, activeInstances])

  const hitsPerPage = oneResultOnly ? 1 : 20

  useEffect(() => {
    if (!debounceOn) {
      setDebouncedQuery(query)
      return
    }
    const timer = setTimeout(() => setDebouncedQuery(query), 150)
    return () => clearTimeout(timer)
  }, [query, debounceOn])

  const clientCacheRef = useRef({})

  useEffect(() => {
    if (!discoveryDone) return
    let cancelled = false
    const cache = clientCacheRef.current
    const activeKeys = new Set()

    async function initClients() {
      const newClients = {}

      for (const slot of resolvedSlots) {
        const inst = slot.instance
        if (!inst || slot.reason) continue

        const cb = createMetricsCallback(inst.id)
        if (inst.engine === 'flapjack') {
          const cacheKey = `${inst.id}:fj:${sortBy || ''}`
          activeKeys.add(cacheKey)
          if (!cache[cacheKey]) cache[cacheKey] = await createFlapjackClient(inst.host, cb, sortBy)
          newClients[inst.id] = cache[cacheKey]
        } else if (inst.engine === 'algolia') {
          if (!sortBy) {
            const cacheKey = `${inst.id}:alg`
            activeKeys.add(cacheKey)
            if (!cache[cacheKey]) cache[cacheKey] = await createAlgoliaClient(inst.auth.appId, inst.auth.apiKey, cb)
            newClients[inst.id] = cache[cacheKey]
          }
        } else if (inst.engine === 'meilisearch') {
          const cacheKey = `${inst.id}:ms`
          activeKeys.add(cacheKey)
          if (!cache[cacheKey]) cache[cacheKey] = await createMeilisearchClient(inst.host, inst.auth.apiKey, cb)
          newClients[inst.id] = cache[cacheKey]
        }
      }

      for (const key of Object.keys(cache)) {
        if (!activeKeys.has(key)) delete cache[key]
      }

      if (!cancelled) {
        setClients(newClients)
      }
    }

    initClients()

    async function initTypesense() {
      for (const slot of resolvedSlots) {
        const inst = slot.instance
        if (!inst || inst.engine !== 'typesense' || slot.reason === 'no collection') continue
        const tsHost = inst.host.replace(/^https?:\/\//, '')
        const tsPort = inst.port || 443
        const tsProtocol = inst.protocol || 'https'
        const queryBy = await fetchTypesenseQueryFields(tsHost, inst.auth.apiKey, indexName, tsPort, tsProtocol)
        if (cancelled) return
        if (queryBy) {
          const cacheKey = `${inst.id}:ts:${sortBy || ''}:${hitsPerPage}:${queryBy}`
          if (!clientCacheRef.current[cacheKey]) {
            clientCacheRef.current[cacheKey] = await createTypesenseClient(tsHost, inst.auth.apiKey, indexName, sortBy, hitsPerPage, queryBy, createMetricsCallback(inst.id), tsPort, tsProtocol)
          }
          if (!cancelled) {
            setClients(prev => ({ ...prev, [inst.id]: clientCacheRef.current[cacheKey] }))
          }
        }
      }
    }
    initTypesense()

    return () => { cancelled = true }
  }, [discoveryDone, resolvedSlots, indexName, sortBy, hitsPerPage, createMetricsCallback])



  const chartData = useMemo(() => resolvedSlots.map(slot => {
    const inst = slot.instance
    const active = inst && !slot.reason
    const sortDisabled = sortBy && slot.engine === 'algolia'
    return {
      slotId: slot.slotId,
      name: slot.label,
      engine: slot.engine,
      ip: inst?.ip || '—',
      region: inst?.region || '—',
      latency: inst ? (metrics[inst.id]?.latency ?? '--') : '--',
      active: active && !sortDisabled,
      reason: slot.reason || (sortDisabled ? 'sort N/A' : null),
      note: inst?.note || null,
    }
  }), [resolvedSlots, metrics, sortBy])

  const maxLatency = 500

  const handleCopyChart = () => {
    const lines = chartData.map(s => s.active
      ? `${String(s.latency).padStart(4)} ms  ${s.name.padEnd(20)} ${s.region.padEnd(12)} ${s.ip}`
      : `   —     ${s.name.padEnd(20)} ${s.region.padEnd(12)} ${s.ip} (${s.reason || 'N/A'})`)
    navigator.clipboard.writeText(`Query: "${query}"\nCollection: ${indexName}\n${'─'.repeat(50)}\n${lines.join('\n')}`)
  }

  const handleCopyAll = () => {
    const lines = chartData.map(s => s.active
      ? `${String(s.latency).padStart(4)} ms  ${s.name.padEnd(20)} ${s.region.padEnd(12)} ${s.ip}`
      : `   —     ${s.name.padEnd(20)} ${s.region.padEnd(12)} ${s.ip} (${s.reason || 'N/A'})`)
    const chartText = `Query: "${query}"\nCollection: ${indexName}\n${'─'.repeat(50)}\n${lines.join('\n')}\n${'─'.repeat(50)}\n\n`
    const resultsText = document.getElementById('copy-content')?.innerText || ''
    navigator.clipboard.writeText(chartText + resultsText)
  }

  const regions = [...new Set(INSTANCES.filter(i => i.enabled && i.region !== 'local').map(i => i.region))]

  return (
    <div className="app">
      {devMode && <div style={{display:'flex',gap:'8px',marginBottom:'8px',alignItems:'stretch'}}>
        <button style={{background:'#333',color:'#fff',border:'none',borderRadius:'4px',padding:'16px 24px',cursor:'pointer',fontWeight:'bold',fontSize:'18px',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',minWidth:'80px'}} onClick={() => {navigator.clipboard.writeText(document.getElementById('debug-text').innerText)}}>📋<br/>Copy</button>
        <pre id="debug-text" style={{background:'#1e1e1e',color:'#d4d4d4',padding:'10px',fontFamily:'monospace',fontSize:'11px',whiteSpace:'pre-wrap',flex:1,margin:0,borderRadius:'4px',userSelect:'text',cursor:'text',maxHeight:'300px',overflow:'auto'}}>
{`=== FLAPJACK DEMO DEBUG ===
state: collections=${collectionNames.length} index="${indexName}" region=${region}
clients: ${Object.keys(clients).join(', ')||'none'}
slots:
${resolvedSlots.map(s => `  ${s.slotId.padEnd(14)} inst=${(s.instance?.id||'null').padEnd(16)} ${s.reason ? 'BLOCKED: '+s.reason : 'OK'}`).join('\n')}
col["${indexName}"]: ${discoveredCollections[indexName] ? Object.entries(discoveredCollections[indexName].instances).map(([id,v]) => `${id}(${v.docCount})`).join(', ') : 'NOT FOUND'}

=== EVENT LOG (${metricsLogRef.current.length} entries) ===
${metricsLogRef.current.slice(-30).map(e => {
  const t = `t+${String(e.t).padStart(5)}ms`
  if (e.type === 'config') return `  ${t}  ── ${e.msg} ──`
  const id = e.id.padEnd(16)
  const lat = String(e.latency).padStart(4) + 'ms'
  const k = e.k2r !== null ? String(e.k2r).padStart(4) + 'ms' : '   - '
  const d = e.db ? 'D' : ' '
  const h = String(e.nbHits).padStart(5)
  const q = (e.q || '').slice(0, 20).padEnd(20)
  const col = (e.col || '').padEnd(12)
  return `  ${t}  ${d} ${col} "${q}" ${id} ${lat}  k2r:${k}  ${h} hits`
}).join('\n') || '  (none yet)'}
  ── D=debounced · col=collection · q=query (20ch max) ──

=== TIMING ===
  facet fetch: ${window.__facetFetchMs || '?'}ms
  first result: ${metricsLogRef.current.length > 0 ? metricsLogRef.current[0].t + 'ms' : '?'}

=== DIAGNOSTICS ===
  double-fire check: ${(() => {
    const log = metricsLogRef.current
    const byId = {}
    for (const e of log) { if (!byId[e.id]) byId[e.id] = []; byId[e.id].push(e) }
    const issues = []
    for (const [id, entries] of Object.entries(byId)) {
      const rapid = []
      for (let i = 1; i < entries.length; i++) {
        const gap = entries[i].t - entries[i-1].t
        if (gap < 500) rapid.push(`${gap}ms`)
      }
      if (rapid.length > 0) issues.push(`${id}: ${rapid.length} rapid re-fires (${rapid.join(', ')})`)
    }
    return issues.length > 0 ? '⚠️ RAPID RE-FIRES\\n    ' + issues.join('\\n    ') : '✅ no rapid re-fires'
  })()}
  metrics updates: ${Object.keys(metrics).length} instances tracked

=== KEYSTROKE-TO-RENDER (k2r) ===
${Object.entries(window.__k2r || {}).map(([id, ms]) => `  ${id.padEnd(16)} ${ms}ms`).join('\n') || '  (no data yet)'}

=== SETTINGS ===
  debounce: ${debounceOn ? 'ON (150ms)' : 'OFF'}  oneResult: ${oneResultOnly ? 'ON' : 'OFF'}

=== FJ-LOCAL CLIENT DEBUG ===
${(window.__fjLocalDebug || []).map(e => `  client=${e.cid} call#${e.n} raw=${e.raw}ms rounded=${e.ms}ms hits=${e.hits}`).join('\n') || '  (no calls yet)'}`}
        </pre>
      </div>}
      <div className="control-bar">
        <select className="region-select" value={region} onChange={(e) => setRegion(e.target.value)}>
          {regions.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="index-select" value={indexName} onChange={(e) => setIndexName(e.target.value)}>
          {(() => {
            const remote = []
            const localOnly = []
            for (const name of collectionNames) {
              const col = discoveredCollections[name]
              if (!col) continue
              const instanceIds = Object.keys(col.instances)
              const isLocalOnly = instanceIds.every(id => id === 'fj-local')
              if (isLocalOnly) localOnly.push(name)
              else remote.push(name)
            }
            const ENGINE_SHORT = { flapjack: 'fj', algolia: 'al', meilisearch: 'ms', typesense: 'ts' }
            const renderOption = (name) => {
              const col = discoveredCollections[name]
              const totalDocs = col ? Math.max(...Object.values(col.instances).map(i => i.docCount || 0), 0) : 0
              const engines = col ? [...new Set(Object.entries(col.instances).map(([id, i]) => {
                const base = ENGINE_SHORT[i.engine] || i.engine
                return id === 'fj-local' ? 'fjl' : base
              }))] : []
              const desc = COLLECTION_DESCRIPTIONS[name] || ''
              return (
                <option key={name} value={name}>
                  {name}{totalDocs > 0 ? ` (${totalDocs.toLocaleString()} docs)` : ''}{engines.length > 0 ? ` · ${engines.join(', ')}` : ''}{desc ? ` — ${desc}` : ''}
                </option>
              )
            }
            return (
              <>
                <optgroup label="Remote">
                  {remote.map(renderOption)}
                </optgroup>
                {localOnly.length > 0 && (
                  <optgroup label="Local only (dev)">
                    {localOnly.map(renderOption)}
                  </optgroup>
                )}
              </>
            )
          })()}
        </select>
        <button className={`control-btn ${devMode ? 'active' : ''}`} onClick={() => {
          const newVal = !devMode
          setDevMode(newVal)
          const url = new URL(window.location)
          if (newVal) url.searchParams.set('dev', '')
          else url.searchParams.delete('dev')
          window.history.replaceState({}, '', url)
        }}>
          DEV: {devMode ? 'ON' : 'OFF'}
        </button>
        <button className={`control-btn ${oneResultOnly ? 'active' : ''}`} onClick={() => setOneResultOnly(!oneResultOnly)}>
          1 RESULT: {oneResultOnly ? 'ON' : 'OFF'}
        </button>
        <button className={`control-btn ${!debounceOn ? 'active' : ''}`} style={{position:'relative',overflow:'hidden'}} onClick={() => {
          if (debounceOn) {
            metricsLogRef.current.push({ type: 'config', t: Math.round(performance.now() - appMountTime.current), msg: 'debounce OFF' })
            setDebounceOn(false)
            debounceStartRef.current = Date.now()
            setDebounceCountdown(10)
            if (debounceTimerRef.current) clearInterval(debounceTimerRef.current)
            debounceTimerRef.current = setInterval(() => {
              const elapsed = (Date.now() - debounceStartRef.current) / 1000
              const remaining = 10 - elapsed
              if (remaining <= 0) {
                setDebounceOn(true)
                setDebounceCountdown(0)
                clearInterval(debounceTimerRef.current)
                debounceTimerRef.current = null
              } else {
                setDebounceCountdown(remaining)
              }
            }, 50)
          } else {
            metricsLogRef.current.push({ type: 'config', t: Math.round(performance.now() - appMountTime.current), msg: 'debounce ON' })
            setDebounceOn(true)
            setDebounceCountdown(0)
            if (debounceTimerRef.current) { clearInterval(debounceTimerRef.current); debounceTimerRef.current = null }
          }
        }}>
          {!debounceOn && <div style={{position:'absolute',top:0,left:0,bottom:0,width:`${(1-debounceCountdown/10)*100}%`,background:'rgba(180,180,180,0.35)',transition:'width 50ms linear',pointerEvents:'none'}}/>}
          DEBOUNCE: {debounceOn ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="header-search-row">
        <div className="header-search-col">
          <div className="header" style={{position:'relative'}}>
            <h1>Search Engine Comparison</h1>
            <a href={DEMO_NAV_LINKS.geoDemo} target="_blank" rel="noopener noreferrer" style={{color:'#D2B48C',fontSize:'13px',marginLeft:'12px',textDecoration:'none',border:'1px solid #555',padding:'4px 10px',borderRadius:'4px'}}>🌍 Flapjack Geo Demo</a>
            <a href={DEMO_NAV_LINKS.apiDocs} target="_blank" rel="noopener noreferrer" style={{color:'#D2B48C',fontSize:'13px',marginLeft:'12px',textDecoration:'none',border:'1px solid #555',padding:'4px 10px',borderRadius:'4px'}}>📚 Flapjack API Docs</a>
            <p>Compare the selected collection across available search backends <span style={{fontSize: '10px', color: '#999'}}>v{BUILD_VERSION}</span>
            </p>
            <p style={{fontSize: '11px', color: '#888', margin: '2px 0 0 0'}}>Latency values reflect browser-observed network round trips. Columns appear only for backends that host the selected collection.</p>
          </div>
          <div className="search-container">
            <input
              type="text"
              className="ais-SearchBox-input"
              placeholder="Search..."
              value={query}
              onChange={(e) => { keystrokeTimeRef.current = performance.now(); setQuery(e.target.value) }}
            />
          </div>
          <FiltersPanel
            customFilter={customFilter}
            setCustomFilter={setCustomFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            selectedFacets={selectedFacets}
            setSelectedFacets={setSelectedFacets}
            facetValues={facetValues}
          />
        </div>
        <LatencyChart
          chartData={chartData}
          maxLatency={maxLatency}
          query={debouncedQuery}
          indexName={indexName}
          customFilter={customFilter}
          selectedFacets={selectedFacets}
          onCopyChart={handleCopyChart}
          onCopyAll={handleCopyAll}
          sortBy={sortBy}
        />
      </div>

      <div className="copy-section">
        <div id="copy-content">
          <div className="results-container">
            {resolvedSlots.map(slot => {
              const inst = slot.instance
              const col = discoveredCollections[indexName]
              const docCount = inst && col && col.instances[inst.id] ? col.instances[inst.id].docCount : 0

              return (
                <ServiceColumn
                  key={slot.slotId}
                  client={inst ? (clients[inst.id] || null) : null}
                  indexName={indexName}
                  instance={inst}
                  slot={slot}
                  query={debouncedQuery}
                  hitsPerPage={hitsPerPage}
                  devMode={devMode}
                  latency={inst ? (metrics[inst.id]?.latency ?? '--') : '--'}
                  docCount={docCount}
                  filters={inst ? buildFilterString(customFilter, selectedFacets, inst.engine) : ''}
                  facetAttributes={facetAttributes}
                  facetsReady={facetsReady}
                  sortBy={sortBy}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
