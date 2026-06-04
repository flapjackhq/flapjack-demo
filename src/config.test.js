import { describe, it, expect } from 'vitest'
import {
  INSTANCES,
  SERVICE_SLOTS,
  COLLECTION_DESCRIPTIONS,
  ENGINE_URLS,
  DEMO_NAV_LINKS,
  DEFAULT_DEMO_INDEX,
  sanitizeDemoIndex,
  encodeDemoIndexPathSegment,
} from './config'
import { KNOWN_COLLECTIONS } from './known-collections'

// ── Config integrity tests ──────────────────────────────────────────────────
// These ensure the demo site config is valid and self-consistent.

describe('INSTANCES config', () => {
  it('fj-namesmaxfj instance exists and is enabled', () => {
    const inst = INSTANCES.find(i => i.id === 'fj-namesmaxfj')
    expect(inst).toBeDefined()
    expect(inst.enabled).toBe(true)
  })

  it('fj-namesmaxfj uses HTTPS host (no mixed content on production)', () => {
    const inst = INSTANCES.find(i => i.id === 'fj-namesmaxfj')
    expect(inst.host).toMatch(/^https:\/\//)
  })

  it('fj-namesmaxfj has correct engine and region', () => {
    const inst = INSTANCES.find(i => i.id === 'fj-namesmaxfj')
    expect(inst.engine).toBe('flapjack')
    expect(inst.region).toBe('us-west-1')
  })

  it('fj-namesmaxfj has algolia-type auth with test credentials', () => {
    const inst = INSTANCES.find(i => i.id === 'fj-namesmaxfj')
    expect(inst.auth.type).toBe('algolia')
    expect(inst.auth.appId).toBe('test-app')
    expect(inst.auth.apiKey).toBe('test-key')
  })

  it('all enabled instances have a host', () => {
    for (const inst of INSTANCES.filter(i => i.enabled)) {
      expect(inst.host).toBeTruthy()
    }
  })

  it('all instances have unique IDs', () => {
    const ids = INSTANCES.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('no non-local instances use plain HTTP (security)', () => {
    for (const inst of INSTANCES.filter(i => i.enabled && i.region !== 'local')) {
      if (inst.host.startsWith('http://')) {
        // IP-based access is allowed (no SSL cert)
        expect(inst.host).toMatch(/http:\/\/\d/)
      }
    }
  })
})

describe('KNOWN_COLLECTIONS config', () => {
  it('namesMaxFj collection is defined', () => {
    expect(KNOWN_COLLECTIONS.namesMaxFj).toBeDefined()
    expect(KNOWN_COLLECTIONS.namesMaxFj.name).toBe('namesMaxFj')
  })

  it('namesMaxFj references valid instance ID', () => {
    const instanceIds = INSTANCES.map(i => i.id)
    for (const id of Object.keys(KNOWN_COLLECTIONS.namesMaxFj.instances)) {
      expect(instanceIds).toContain(id)
    }
  })

  it('namesMaxFj has expected doc count (10.8M+ actual loaded)', () => {
    const fjInst = KNOWN_COLLECTIONS.namesMaxFj.instances['fj-namesmaxfj']
    expect(fjInst).toBeDefined()
    expect(fjInst.docCount).toBe(10819000)
  })

  it('all known collections reference valid instance IDs', () => {
    const instanceIds = INSTANCES.map(i => i.id)
    for (const [colName, col] of Object.entries(KNOWN_COLLECTIONS)) {
      for (const id of Object.keys(col.instances)) {
        expect(instanceIds, `${colName} references unknown instance ${id}`).toContain(id)
      }
    }
  })
})

describe('demo index sanitization', () => {
  const allowedIndexes = Object.keys(KNOWN_COLLECTIONS)

  it('accepts known collection IDs from the URL', () => {
    expect(sanitizeDemoIndex('namesMaxFj', allowedIndexes)).toBe('namesMaxFj')
  })

  it('falls back for unknown or path-like collection IDs', () => {
    expect(sanitizeDemoIndex('../internal', allowedIndexes)).toBe(DEFAULT_DEMO_INDEX)
    expect(sanitizeDemoIndex('products/settings', allowedIndexes)).toBe(DEFAULT_DEMO_INDEX)
    expect(sanitizeDemoIndex('', allowedIndexes)).toBe(DEFAULT_DEMO_INDEX)
  })

  it('encodes collection IDs before path interpolation', () => {
    expect(encodeDemoIndexPathSegment('products/settings')).toBe('products%2Fsettings')
  })
})

describe('SERVICE_SLOTS config', () => {
  it('has flapjack slot', () => {
    expect(SERVICE_SLOTS.find(s => s.slotId === 'flapjack')).toBeDefined()
  })

  it('all slots have required fields', () => {
    for (const slot of SERVICE_SLOTS) {
      expect(slot.slotId).toBeTruthy()
      expect(slot.engine).toBeTruthy()
      expect(slot.label).toBeTruthy()
    }
  })

  it('flapjack engine URL points to the public OSS repository', () => {
    expect(ENGINE_URLS.flapjack).toBe('https://github.com/flapjackhq/flapjack')
  })

  it('demo nav links keep launch routes source-owned', () => {
    expect(DEMO_NAV_LINKS.geoDemo).toBe('/geo.html')
    expect(DEMO_NAV_LINKS.apiDocs).toBe('https://docs.flapjack.foo/api/overview/')
  })
})

describe('COLLECTION_DESCRIPTIONS', () => {
  it('namesMaxFj has a description', () => {
    expect(COLLECTION_DESCRIPTIONS.namesMaxFj).toBeTruthy()
    expect(COLLECTION_DESCRIPTIONS.namesMaxFj).toContain('11M')
  })

  it('every known collection has a description', () => {
    for (const colName of Object.keys(KNOWN_COLLECTIONS)) {
      expect(COLLECTION_DESCRIPTIONS[colName], `missing description for ${colName}`).toBeTruthy()
    }
  })
})
