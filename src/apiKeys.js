/**
 * Public API Keys for demo-dualclient
 *
 * SAFETY: All keys below are SEARCH-ONLY and safe to commit to git.
 * They CANNOT create/delete collections, modify data, or change settings.
 *
 * Generated: 2026-02-10
 * Script: s/generate_search_keys.sh
 */

export const API_KEYS = {
  typesense: {
    // Typesense search-only keys
    // Permissions: actions=["documents:search", "collections:get"], collections=["*"]
    // NOTE: Each instance has its own key
    'ts-usw1': {
      key: '0c1WJSGQDrby5dIgSzkHPFmXCnAQrhf5',
      scope: 'search-only',
      permissions: ['documents:search', 'collections:get'],
      host: 'ts-us-west-1.flapjack.foo',
      generated: '2026-02-10',
    },
    'ts-namesmaxts': {
      key: 'ZA1wWAPk2oIzqH9iZc6zKMexxWpBj8dA',
      scope: 'search-only',
      permissions: ['documents:search', 'collections:get'],
      host: 'ts-us-west-1-namesmaxts.flapjack.foo',
      generated: '2026-02-10',
    },
    'ts-namesmaxms': {
      key: '54PfyF02NFfZOmkZCudNdqglfOk3OZJG',
      scope: 'search-only',
      permissions: ['documents:search', 'collections:get'],
      host: 'ts-us-west-1-namesmaxms.flapjack.foo',
      generated: '2026-02-10',
    },
  },

  meilisearch: {
    // Meilisearch search-only keys
    // Permissions: actions=["search"], indexes=["*"]
    // NOTE: Each instance has its own key
    'ms-usw1': {
      key: 'af1615d3701b03b1d5c4c624ccfbb8dd44872a4525e0fcc133448bce38c7af65',
      scope: 'search-only',
      permissions: ['search'],
      host: 'ms-us-west-1.flapjack.foo',
      generated: '2026-02-10',
    },
    'ms-namesmaxms': {
      key: 'be6084972e8dcb6f10c365c67138d8d40075977e7a4cb9b179ae4bea220b5d85',
      scope: 'search-only',
      permissions: ['search'],
      host: 'ms-us-west-1-namesmaxms.flapjack.foo',
      generated: '2026-02-10',
    },
  },

  flapjack: {
    // Flapjack test keys (safe for demo)
    default: {
      appId: 'test-app',
      key: 'test-key',
      scope: 'test',
      note: 'Test credentials for demo',
    },
  },

  algolia: {
    // Algolia search-only keys
    // Permissions: search API (no admin/write access)
    'alg-usw1': {
      appId: 'NUY9M4C8ES',
      key: 'd8d110dc52e6e596ec64f15382429a72',
      scope: 'search-only',
      permissions: ['search'],
      region: 'us-west',
      generated: '2026-02-10',
    },
    'alg-use1': {
      appId: '9HEYZQZHL7',
      key: '5bf916986dd5cbd39b19a1acadb87037',
      scope: 'search-only',
      permissions: ['search'],
      region: 'us-east',
      generated: '2026-02-10',
    },
  },
}

/**
 * Helper to get API key for an instance
 * @param {string} engine - Engine name (typesense, meilisearch, flapjack, algolia)
 * @param {string} instanceId - Instance ID (ts-usw1, ms-usw1, etc.)
 */
export function getApiKey(engine, instanceId) {
  const engineKeys = API_KEYS[engine]
  if (!engineKeys) {
    throw new Error(`Unknown engine: ${engine}`)
  }

  const instance = engineKeys[instanceId]
  if (!instance) {
    // For flapjack, return default if instance not found
    if (engine === 'flapjack') {
      return engineKeys.default
    }
    throw new Error(`Unknown instance: ${instanceId} for engine ${engine}`)
  }

  return instance
}
