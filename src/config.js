import { getApiKey } from './apiKeys.js'

export const IS_LOCALHOST = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
export const BUILD_VERSION = typeof __BUILD_VERSION__ !== 'undefined' ? __BUILD_VERSION__ : 'dev'
export const DEFAULT_DEMO_INDEX = 'bestbuy'

function resolveDemoIndexFallback(allowedIndexes, fallback = DEFAULT_DEMO_INDEX) {
  if (Array.isArray(allowedIndexes) && allowedIndexes.includes(fallback)) {
    return fallback
  }
  if (!Array.isArray(allowedIndexes) || allowedIndexes.length === 0) {
    return fallback
  }
  return allowedIndexes.find(name => !name.startsWith('test_')) || allowedIndexes[0]
}

// The demo exposes collection choice via `?index=...`, so only known IDs are
// accepted. This prevents a crafted URL from steering browser-side API keys at
// arbitrary backend paths before the React fallback effect runs.
export function sanitizeDemoIndex(rawIndex, allowedIndexes, fallback = DEFAULT_DEMO_INDEX) {
  const safeFallback = resolveDemoIndexFallback(allowedIndexes, fallback)
  if (typeof rawIndex !== 'string' || rawIndex.length === 0) {
    return safeFallback
  }
  return allowedIndexes.includes(rawIndex) ? rawIndex : safeFallback
}

export function encodeDemoIndexPathSegment(indexName) {
  return encodeURIComponent(indexName)
}

export const ENGINE_COLORS = {
  flapjack: '#D2B48C',
  algolia: '#5165F6',
  meilisearch: '#FF5484',
  typesense: '#343FD7',
}

export const ENGINE_LABELS = {
  flapjack: 'Flapjack-beta',
  algolia: 'Algolia',
  meilisearch: 'Meilisearch',
  typesense: 'Typesense',
}

export const ENGINE_URLS = {
  flapjack: 'https://github.com/flapjackhq/flapjack',
  algolia: 'https://www.algolia.com/',
  meilisearch: 'https://github.com/meilisearch/meilisearch',
  typesense: 'https://github.com/typesense/typesense',
}

export const DEMO_NAV_LINKS = {
  geoDemo: '/geo.html',
  apiDocs: 'https://docs.flapjack.foo/api/overview/',
}

export const SERVICE_SLOTS = [
  { slotId: 'fj-local', engine: 'flapjack', label: 'Flapjack-beta (local)', localOnly: true },
  { slotId: 'flapjack', engine: 'flapjack', label: 'Flapjack-beta' },
  { slotId: 'typesense', engine: 'typesense', label: 'Typesense' },
  { slotId: 'meilisearch', engine: 'meilisearch', label: 'Meilisearch' },
  { slotId: 'algolia', engine: 'algolia', label: 'Algolia' },
]

export const INSTANCES = [
  {
    id: 'fj-local',
    engine: 'flapjack',
    ip: 'localhost',
    host: 'http://localhost:7700',
    region: 'local',
    specs: { type: 'local', ram: '-', vcpu: '-', cost: '-' },
    enabled: IS_LOCALHOST,
    auth: { type: 'algolia', appId: getApiKey('flapjack', 'default').appId, apiKey: getApiKey('flapjack', 'default').key },
  },
  {
    id: 'fj-usw1',
    engine: 'flapjack',
    ip: '52.53.64.231',
    host: 'https://fj-us-west-1.flapjack.foo',
    region: 'us-west-1',
    specs: { type: 't4g.micro', ram: '1GB', vcpu: 2, cost: '~$4/mo' },
    enabled: true,
    auth: { type: 'algolia', appId: getApiKey('flapjack', 'default').appId, apiKey: getApiKey('flapjack', 'default').key },
  },
  {
    id: 'fj-namesmaxfj',
    engine: 'flapjack',
    ip: '54.151.72.213',
    host: 'https://fj-us-west-1-namesmaxfj.flapjack.foo',
    region: 'us-west-1',
    specs: { type: 't4g.micro', ram: '1GB', vcpu: 2, cost: '~$4/mo' },
    enabled: true,
    auth: { type: 'algolia', appId: getApiKey('flapjack', 'default').appId, apiKey: getApiKey('flapjack', 'default').key },
    note: 'FJ ceiling: 11M names on 1GB',
  },
  {
    id: 'fj-namesmaxts',
    engine: 'flapjack',
    ip: '50.18.188.139',
    host: 'https://50.18.188.139',
    region: 'us-west-1',
    specs: { type: 't4g.micro', ram: '1GB', vcpu: 2, cost: '~$4/mo' },
    enabled: true,
    auth: { type: 'algolia', appId: getApiKey('flapjack', 'default').appId, apiKey: getApiKey('flapjack', 'default').key },
    note: 'FJ matching TS ceiling: 4M names on 1GB (IP-based access)',
  },
  {
    id: 'fj-namesmaxms',
    engine: 'flapjack',
    ip: '54.215.233.240',
    host: 'https://fj-us-west-1-namesmaxms.flapjack.foo',
    region: 'us-west-1',
    specs: { type: 't4g.micro', ram: '1GB', vcpu: 2, cost: '~$4/mo' },
    enabled: true,
    auth: { type: 'algolia', appId: getApiKey('flapjack', 'default').appId, apiKey: getApiKey('flapjack', 'default').key },
    note: 'FJ holding MS ceiling: 400K names on 1GB',
  },
  {
    id: 'ts-usw1',
    engine: 'typesense',
    ip: '52.8.86.194',
    host: 'ts-us-west-1.flapjack.foo',
    region: 'us-west-1',
    specs: { type: 't4g.micro', ram: '1GB', vcpu: 2, cost: '~$4/mo' },
    enabled: true,
    auth: { type: 'typesense', apiKey: getApiKey('typesense', 'ts-usw1').key },
  },
  {
    id: 'ts-namesmaxts',
    engine: 'typesense',
    ip: '54.241.234.240',
    host: '54.241.234.240',
    port: 443,
    protocol: 'https',
    region: 'us-west-1',
    specs: { type: 't4g.micro', ram: '1GB', vcpu: 2, cost: '~$4/mo' },
    enabled: true,
    auth: { type: 'typesense', apiKey: getApiKey('typesense', 'ts-namesmaxts').key },
    note: 'TS ceiling: 4M names on 1GB (IP-based SSL)',
  },
  {
    id: 'ts-namesmaxms',
    engine: 'typesense',
    ip: '52.9.109.239',
    host: 'ts-us-west-1-namesmaxms.flapjack.foo',
    port: 443,
    protocol: 'https',
    region: 'us-west-1',
    specs: { type: 't4g.micro', ram: '1GB', vcpu: 2, cost: '~$4/mo' },
    enabled: true,
    auth: { type: 'typesense', apiKey: getApiKey('typesense', 'ts-namesmaxms').key },
    note: 'TS holding MS ceiling: 400K names on 1GB',
  },
  {
    id: 'ms-usw1',
    engine: 'meilisearch',
    ip: '52.9.128.25',
    host: 'https://ms-us-west-1.flapjack.foo',
    region: 'us-west-1',
    specs: { type: 't4g.micro', ram: '1GB', vcpu: 2, cost: '~$4/mo' },
    enabled: true,
    auth: { type: 'meilisearch', apiKey: getApiKey('meilisearch', 'ms-usw1').key },
  },
  {
    id: 'ms-namesmaxms',
    engine: 'meilisearch',
    ip: '52.8.7.59',
    host: 'https://ms-us-west-1-namesmaxms.flapjack.foo',
    region: 'us-west-1',
    specs: { type: 't4g.micro', ram: '1GB', vcpu: 2, cost: '~$4/mo' },
    enabled: true,
    auth: { type: 'meilisearch', apiKey: getApiKey('meilisearch', 'ms-namesmaxms').key },
    note: 'MS ceiling: 400K names on 1GB',
  },
  {
    id: 'alg-usw1',
    engine: 'algolia',
    ip: 'SaaS',
    host: 'https://NUY9M4C8ES-dsn.algolia.net',
    region: 'us-west-1',
    specs: { type: 'SaaS', ram: '?', vcpu: '?', cost: 'pay-per-use' },
    enabled: true,
    auth: { type: 'algolia', appId: getApiKey('algolia', 'alg-usw1').appId, apiKey: getApiKey('algolia', 'alg-usw1').key },
    note: 'SaaS — not self-hosted, not apples-to-apples',
  },
]

export const COLLECTION_DESCRIPTIONS = {
  'products': 'Mixed product catalog from dummyjson.com',
  'bestbuy': 'Best Buy product catalog - electronics, appliances',
  'names': 'Person names - typeahead benchmark',
  'namesMaxMs': 'MS ceiling test: 400K names (max MS can hold on 1GB)',
  'namesMaxTs': 'TS ceiling test: 4M names on 1GB',
  'namesMaxFj': 'FJ ceiling test: 11M names (max FJ can hold on 1GB)',
}
