export const KNOWN_COLLECTIONS = {
  bestbuy: {
    name: 'bestbuy',
    instances: {
      'fj-local': { docCount: 21469, fields: [], engine: 'flapjack', region: 'local' },
      'fj-usw1': { docCount: 21469, fields: [], engine: 'flapjack', region: 'us-west-1' },
      'ts-usw1': { docCount: 21469, fields: [], engine: 'typesense', region: 'us-west-1' },
      'ms-usw1': { docCount: 21469, fields: [], engine: 'meilisearch', region: 'us-west-1' },
      'alg-usw1': { docCount: 21469, fields: [], engine: 'algolia', region: 'us-west-1' },
    }
  },
  products: {
    name: 'products',
    instances: {
      'alg-usw1': { docCount: 194, fields: [], engine: 'algolia', region: 'us-west-1' },
    }
  },
  namesMaxFj: {
    name: 'namesMaxFj',
    instances: {
      'fj-namesmaxfj': { docCount: 10819000, fields: [], engine: 'flapjack', region: 'us-west-1' },
    }
  },
  // namesMaxTs: {
  //   name: 'namesMaxTs',
  //   instances: {
  //     'fj-namesmaxts': { docCount: 4000000, fields: [], engine: 'flapjack', region: 'us-west-1' },
  //     'ts-namesmaxts': { docCount: 4000000, fields: [], engine: 'typesense', region: 'us-west-1' },
  //   }
  // },
  namesMaxMs: {
    name: 'namesMaxMs',
    instances: {
      'fj-namesmaxms': { docCount: 400000, fields: [], engine: 'flapjack', region: 'us-west-1' },
      'ts-namesmaxms': { docCount: 400000, fields: [], engine: 'typesense', region: 'us-west-1' },
      'ms-namesmaxms': { docCount: 400000, fields: [], engine: 'meilisearch', region: 'us-west-1' },
    }
  },
}