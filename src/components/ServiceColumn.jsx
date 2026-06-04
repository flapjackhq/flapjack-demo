import { useState, useCallback, memo } from 'react'
import { InstantSearch, Hits, Configure, Pagination } from 'react-instantsearch'
import { ENGINE_URLS } from '../config'
import { Hit } from './Hit'
import { StatsReporter } from './StatsReporter'

const HitProd = (props) => <Hit {...props} devMode={false} />
const HitDev = (props) => <Hit {...props} devMode={true} />

export const ServiceColumn = memo(function ServiceColumn({
  client, indexName, instance, slot, query, hitsPerPage, devMode,
  latency, docCount, filters, facetAttributes, facetsReady, sortBy
}) {
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(null)
  const [nbHits, setNbHits] = useState(0)

  const [k2r, setK2r] = useState(null)
  const handleStats = useCallback((hits) => {
    setNbHits(hits)
    const ks = window.__keystrokeTime?.current
    if (ks) {
      const val = Math.round(performance.now() - ks)
      setK2r(val)
      window.__k2r = window.__k2r || {}
      window.__k2r[instance?.id || slot.slotId] = val
    }
  }, [instance, slot.slotId])

  const engine = slot.engine
  const label = slot.label

  const specLine = !instance ? '—'
    : instance.engine === 'algolia' ? 'SaaS (not self-hosted)'
    : `${instance.specs.type} · ${instance.specs.ram} RAM · ${instance.specs.vcpu} vCPU · ${instance.specs.cost}`

  const handleShowSettings = async () => {
    if (showSettings) { setShowSettings(false); return }
    if (!instance) return
    setShowSettings(true)
    setSettings('loading...')
    try {
      let res
      if (engine === 'flapjack') {
        res = await fetch(`${instance.host}/1/indexes/${indexName}/settings`, {
          headers: { 'x-algolia-api-key': instance.auth.apiKey, 'x-algolia-application-id': instance.auth.appId }
        })
      } else if (engine === 'algolia') {
        res = await fetch(`${instance.host}/1/indexes/${indexName}/settings`, {
          headers: { 'x-algolia-api-key': instance.auth.apiKey, 'x-algolia-application-id': instance.auth.appId }
        })
      } else if (engine === 'meilisearch') {
        res = await fetch(`${instance.host}/indexes/${indexName}/settings`, {
          headers: { 'Authorization': `Bearer ${instance.auth.apiKey}` }
        })
      } else if (engine === 'typesense') {
        const proto = instance.host.includes('://') ? '' : 'https://'
        res = await fetch(`${proto}${instance.host}/collections/${indexName}`, {
          headers: { 'X-TYPESENSE-API-KEY': instance.auth.apiKey }
        })
      }
      setSettings(res ? await res.json() : null)
    } catch (e) {
      setSettings({ error: e.message })
    }
  }

  const effectiveIndexName = engine === 'meilisearch' && sortBy ? `${indexName}:${sortBy}` : indexName
  const sortNotSupported = sortBy && engine === 'algolia'

  const unavailableReason = !instance ? slot.reason || 'not available'
    : slot.reason === 'no collection' ? `no "${indexName}" collection`
    : slot.reason ? slot.reason
    : sortNotSupported ? 'sort N/A (costs extra)'
    : null

  return (
    <div className={`result-column ${unavailableReason ? 'result-column-inactive' : ''}`}>
      <div className="service-header">
        <h2>{ENGINE_URLS[engine] ? <a href={ENGINE_URLS[engine]} target="_blank" rel="noopener noreferrer" style={{color: 'inherit', textDecoration: 'none', borderBottom: '1px dashed currentColor'}}>{label}</a> : label}</h2>
        <div className="service-header-right">
          {client && !unavailableReason && (
            <span className="service-stats">
              <span className="latency-value">{latency}</span>
              <span className="latency-unit">ms</span>
              {latency !== '--' && latency < 10 ? ' (cached)' : ''} · {nbHits.toLocaleString()}/{(docCount || 0).toLocaleString()}
              {devMode && k2r !== null && <span className="k2r-value" style={{marginLeft:'6px',color:'#f0a',fontSize:'11px'}}> k2r:{k2r}ms</span>}
            </span>
          )}
          {instance && <button className="settings-icon-btn" onClick={handleShowSettings} title="Show settings">⚙️</button>}
        </div>
      </div>
      {instance && <div className="spec-label">{specLine}</div>}
      {instance && (
        <div className="instance-info">
          {instance.ip} · {instance.region}{instance.note ? ` · ${instance.note}` : ''}
        </div>
      )}

      {showSettings && (
        <pre className="settings-display">{typeof settings === 'string' ? settings : JSON.stringify(settings, null, 2)}</pre>
      )}

      {unavailableReason ? (
        <div className="coming-soon">{unavailableReason}</div>
      ) : !client ? (
        <div className="coming-soon">Loading...</div>
      ) : (
        <InstantSearch searchClient={client} indexName={effectiveIndexName} key={`${instance.id}-${effectiveIndexName}-${sortBy || 'default'}`} future={{ preserveSharedStateOnUnmount: true }}>
          <Configure hitsPerPage={hitsPerPage} query={query} filters={filters || undefined} />
          <StatsReporter onStats={handleStats} />
          <div className="pagination-row"><Pagination /></div>
          <Hits hitComponent={devMode ? HitDev : HitProd} />
          <div className="pagination-row"><Pagination /></div>
        </InstantSearch>
      )}
    </div>
  )
})