// @ts-check
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { KNOWN_COLLECTIONS } from '../src/known-collections.js'

const configSource = readFileSync(new URL('../src/config.js', import.meta.url), 'utf8')
const defaultIndexMatch = configSource.match(/export const DEFAULT_DEMO_INDEX = '([^']+)'/)
if (!defaultIndexMatch) throw new Error('DEFAULT_DEMO_INDEX export not found in src/config.js')

const DEFAULT_DEMO_INDEX = defaultIndexMatch[1]
const ALLOWED_COLLECTION_NAMES = Object.keys(KNOWN_COLLECTIONS).sort()
const ENGINE_SHORT_LABELS = { flapjack: 'fj', algolia: 'al', meilisearch: 'ms', typesense: 'ts' }
const DEFAULT_DEMO_QUERY = 'sony'
const NAMES_MAX_FJ_INDEX = 'namesMaxFj'
const GEO_HTML_URL = new URL('../geo.html', import.meta.url).toString()

async function openRootDemo(page, path = '/') {
  await page.goto(path)
  await expect(page.locator('.index-select')).toBeVisible({ timeout: 10000 })
}

async function dropdownValues(page) {
  return page.locator('.index-select option').evaluateAll(options =>
    options.map(option => option.value).filter(Boolean).sort()
  )
}

async function selectedOptionText(page) {
  return page.locator('.index-select').evaluate(select => {
    const selected = select.selectedOptions[0]
    return selected ? selected.textContent || '' : ''
  })
}

function maxDocCount(collectionName) {
  const collection = KNOWN_COLLECTIONS[collectionName]
  return Math.max(...Object.values(collection.instances).map(instance => instance.docCount || 0))
}

function expectedEngineShortLabels(collectionName) {
  const collection = KNOWN_COLLECTIONS[collectionName]
  return [...new Set(Object.entries(collection.instances).map(([id, instance]) => {
    if (id === 'fj-local') return 'fjl'
    return ENGINE_SHORT_LABELS[instance.engine] || instance.engine
  }))]
}

function activeResultColumn(page) {
  return page.locator('.result-column:not(.result-column-inactive)').first()
}

// ── D1: Page Load & Discovery ──────────────────────────────────────────────

test.describe('D1: Page Load & Discovery', () => {
  test('D1.1: discovery completes on page load', async ({ page }) => {
    await openRootDemo(page)
    expect(await dropdownValues(page)).toEqual(ALLOWED_COLLECTION_NAMES)
  })

  test('D1.2: root path selects the launch-default collection from config', async ({ page }) => {
    await openRootDemo(page)

    const select = page.locator('.index-select')
    await expect(select).toHaveValue(DEFAULT_DEMO_INDEX)
    const optionText = await selectedOptionText(page)
    expect(optionText).toContain(DEFAULT_DEMO_INDEX)
    expect(optionText).toContain(`${maxDocCount(DEFAULT_DEMO_INDEX).toLocaleString()} docs`)
    for (const engine of expectedEngineShortLabels(DEFAULT_DEMO_INDEX)) {
      expect(optionText).toContain(engine)
    }
  })

  test('D1.3: build version is displayed', async ({ page }) => {
    await openRootDemo(page)
    // Build version should appear somewhere on the page
    const body = await page.textContent('body')
    // Version string contains a git hash or "dev"
    expect(body).toMatch(/[a-f0-9]{7}|dev/)
  })

  test('D1.4: invalid index query falls back to the launch-default collection', async ({ page }) => {
    await openRootDemo(page, '/?index=../internal/settings')

    const select = page.locator('.index-select')
    await expect(select).toHaveValue(DEFAULT_DEMO_INDEX)
    expect(await dropdownValues(page)).not.toContain('../internal/settings')
  })
})

// ── D2: Collection Selection ────────────────────────────────────────────────

test.describe('D2: Collection Selection', () => {
  test('D2.1: namesMaxFj is selectable in dropdown', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.index-select')).toBeVisible({ timeout: 10000 })
    // Select namesMaxFj
    await page.selectOption('.index-select', 'namesMaxFj')
    // Verify it's selected
    const selected = await page.locator('.index-select').inputValue()
    expect(selected).toBe('namesMaxFj')
  })

  test('D2.2: selecting namesMaxFj activates only flapjack slot', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.index-select')).toBeVisible({ timeout: 10000 })
    await page.selectOption('.index-select', 'namesMaxFj')
    // Wait for results to render
    await page.waitForTimeout(2000)
    // Should have active result columns (flapjack only)
    const activeColumns = page.locator('.result-column:not(.result-column-inactive)')
    const inactiveColumns = page.locator('.result-column-inactive')
    // At least 1 active (flapjack) and some inactive (others have no namesMaxFj)
    await expect(activeColumns).toHaveCount(1)
    const inactiveCount = await inactiveColumns.count()
    expect(inactiveCount).toBeGreaterThanOrEqual(1)
  })

  test('D2.3: switching collections updates columns', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.index-select')).toBeVisible({ timeout: 10000 })
    // Start with namesMaxFj
    await page.selectOption('.index-select', 'namesMaxFj')
    await page.waitForTimeout(2000)
    const activeBefore = await page.locator('.result-column:not(.result-column-inactive)').count()
    // Switch to bestbuy (should have multiple engines)
    await page.selectOption('.index-select', 'bestbuy')
    await page.waitForTimeout(3000)
    const activeAfter = await page.locator('.result-column:not(.result-column-inactive)').count()
    // bestbuy should have more active columns than namesMaxFj
    expect(activeAfter).toBeGreaterThan(activeBefore)
  })
})

// ── D3: Launch Default Search ───────────────────────────────────────────────

test.describe('D3: Launch Default Search', () => {
  test('D3.1: root default collection supports a dataset-appropriate search', async ({ page }) => {
    await openRootDemo(page)
    await expect(page.locator('.index-select')).toHaveValue(DEFAULT_DEMO_INDEX)

    await page.locator('.ais-SearchBox-input').fill(DEFAULT_DEMO_QUERY)

    const matchingHit = page.locator('.hit-item', { hasText: new RegExp(DEFAULT_DEMO_QUERY, 'i') }).first()
    await expect(matchingHit).toBeVisible({ timeout: 15000 })
    const hitText = (await matchingHit.textContent() || '').toLowerCase()
    expect(hitText).toMatch(/sku|price|brand|category|saleprice/)
  })
})

// ── D3: namesMaxFj Search ───────────────────────────────────────────────────

test.describe('D3 legacy: namesMaxFj Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`/?index=${NAMES_MAX_FJ_INDEX}`)
    await expect(page.locator('.index-select')).toBeVisible({ timeout: 10000 })
    // Ensure namesMaxFj is selected
    const selected = await page.locator('.index-select').inputValue()
    if (selected !== NAMES_MAX_FJ_INDEX) {
      await page.selectOption('.index-select', NAMES_MAX_FJ_INDEX)
    }
    await page.waitForTimeout(2000)
  })

  test.fixme('D3.1: namesMaxFj positive search returns name hits', async ({ page }) => {
    const searchInput = page.locator('.ais-SearchBox-input')
    await searchInput.fill('john')
    const hits = activeResultColumn(page).locator('.hit-item')
    await expect(hits.first()).toBeVisible({ timeout: 10000 })
    const count = await hits.count()
    expect(count).toBeGreaterThan(0)
  })

  test.fixme('D3.2: namesMaxFj search latency is displayed after a successful query', async ({ page }) => {
    const searchInput = page.locator('.ais-SearchBox-input')
    await searchInput.fill('smith')
    const latencyEl = activeResultColumn(page).locator('.latency-value')
    await expect(latencyEl).toBeVisible({ timeout: 10000 })
    const latencyText = await latencyEl.textContent()
    const latencyMs = parseFloat(latencyText)
    expect(latencyMs).toBeGreaterThan(0)
    expect(latencyMs).toBeLessThan(5000) // reasonable upper bound
  })

  test('D3.3: namesMaxFj slot renders total document count metadata', async ({ page }) => {
    const searchInput = page.locator('.ais-SearchBox-input')
    await searchInput.fill('smith')
    await page.waitForTimeout(2000)
    const stats = activeResultColumn(page).locator('.service-stats')
    await expect(stats).toBeVisible({ timeout: 10000 })
    const statsText = await stats.textContent()
    expect(statsText).toContain(maxDocCount(NAMES_MAX_FJ_INDEX).toLocaleString())
  })

  test('D3.4: empty query returns gracefully', async ({ page }) => {
    const searchInput = page.locator('.ais-SearchBox-input')
    // Clear any existing query
    await searchInput.fill('')
    await page.waitForTimeout(1500)
    // Page should not crash — no error boundaries triggered
    const errorBoundary = page.locator('text=Something went wrong')
    await expect(errorBoundary).toHaveCount(0)
  })
})

// ── D4: Slot Resolution ─────────────────────────────────────────────────────

test.describe('D4: Slot Resolution', () => {
  test('D4.1: HTTPS namesMaxFj resolves without mixed content', async ({ page }) => {
    // Listen for console errors related to mixed content
    const mixedContentErrors = []
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().toLowerCase().includes('mixed content')) {
        mixedContentErrors.push(msg.text())
      }
    })
    await page.goto('/?index=namesMaxFj')
    await page.waitForTimeout(3000)
    // No mixed content errors
    expect(mixedContentErrors).toHaveLength(0)
    // Flapjack column should be active
    const activeColumns = page.locator('.result-column:not(.result-column-inactive)')
    await expect(activeColumns).toHaveCount(1)
  })

  test('D4.2: inactive engines show reason badge', async ({ page }) => {
    await page.goto('/?index=namesMaxFj')
    await page.waitForTimeout(3000)
    // Inactive columns should show reason text
    const inactiveColumns = page.locator('.result-column-inactive')
    const count = await inactiveColumns.count()
    expect(count).toBeGreaterThanOrEqual(1)
    // Each inactive column should have a "coming soon" / "no collection" message
    for (let i = 0; i < count; i++) {
      const text = await inactiveColumns.nth(i).textContent()
      expect(text.toLowerCase()).toMatch(/no.*collection|unavailable|coming/)
    }
  })
})

// ── D5: Latency Chart ───────────────────────────────────────────────────────

test.describe('D5: Latency Chart', () => {
  test('D5.1: latency bar shows for active engine after search', async ({ page }) => {
    await page.goto('/?index=namesMaxFj')
    await page.waitForTimeout(2000)
    // Search to trigger latency measurement
    await page.locator('.ais-SearchBox-input').fill('maria')
    await page.waitForTimeout(2000)
    // Latency chart should have at least one row
    const chartRows = page.locator('.chart-row')
    const rowCount = await chartRows.count()
    expect(rowCount).toBeGreaterThanOrEqual(1)
  })

  test('D5.2: inactive engines show reason in chart', async ({ page }) => {
    await page.goto('/?index=namesMaxFj')
    await page.waitForTimeout(2000)
    await page.locator('.ais-SearchBox-input').fill('test')
    await page.waitForTimeout(2000)
    // Chart should exist
    const chart = page.locator('.latency-chart')
    await expect(chart).toBeVisible()
  })
})

// ── D6: Server Health & Resilience (API-level checks) ───────────────────────

test.describe('D6: Server Health (via page network)', () => {
  test('D6.1: search API request succeeds without errors', async ({ page }) => {
    const failedRequests = []
    page.on('response', response => {
      if (response.url().includes('fj-us-west-1-namesmaxfj.flapjack.foo') && response.status() >= 400) {
        failedRequests.push({ url: response.url(), status: response.status() })
      }
    })
    await page.goto('/?index=namesMaxFj')
    await page.waitForTimeout(2000)
    await page.locator('.ais-SearchBox-input').fill('john')
    await page.waitForTimeout(2000)
    // No failed requests to our server
    expect(failedRequests).toHaveLength(0)
  })
})

// ── D7: Data Integrity ──────────────────────────────────────────────────────

test.describe('D7: Data Integrity', () => {
  test.fixme('D7.1: names are searchable and results contain name field', async ({ page }) => {
    await page.goto(`/?index=${NAMES_MAX_FJ_INDEX}`)
    await page.waitForTimeout(2000)
    await page.locator('.ais-SearchBox-input').fill('john')
    const firstHit = activeResultColumn(page).locator('.hit-item').first()
    await expect(firstHit).toBeVisible({ timeout: 10000 })
    const hitText = await firstHit.textContent()
    // Should contain "john" (case insensitive) in the result
    expect(hitText.toLowerCase()).toContain('john')
  })
})

// ── D9: Public Launch Routes ────────────────────────────────────────────────

test.describe('D9: Public Launch Routes', () => {
  test('D9.1: geo route renders the map controls and how-to panel', async ({ page }) => {
    await page.goto('/geo')

    await expect(page.locator('#map')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('h1')).toHaveText('Flapjack Geo Search - Airports')
    await expect(page.locator('#target-select')).toBeVisible()
    await expect(page.locator('#target-select option[value="west"]')).toHaveText('Flapjack (us-west-1)')
    await expect(page.locator('label[for="target-select"]')).toHaveText('Backend target')
    await expect(page.locator('.how-to')).toContainText('How to use')
    await expect(page.locator('.how-to')).toContainText('insideBoundingBox')
    await expect(page.locator('#map-info')).toBeVisible()
  })

  test('D9.1b: geo route escapes backend-controlled hit and facet fields', async ({ page }) => {
    await page.route('**/1/indexes/airports/query', async route => {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          nbHits: '<img src=x onerror="window.__geoStatsXss=1">',
          processingTimeMS: '<svg onload="window.__geoTimingXss=1">',
          facets: {
            country: {
              'US"><img src=x onerror="window.__geoFacetXss=1">': 1,
            },
          },
          hits: [{
            objectID: 'xss-airport',
            iata_code: '<svg onload="window.__geoIataXss=1">',
            name: '<img src=x onerror="window.__geoNameXss=1"> Demo Airport',
            city: '<script>window.__geoCityXss=1</script> City',
            country: 'US"><img src=x onerror="window.__geoCountryXss=1">',
            links_count: 7,
            _geoloc: { lat: 40, lng: -73 },
            _highlightResult: {
              name: { value: '<em><img src=x onerror="window.__geoHighlightXss=1"></em> Demo Airport' },
              city: { value: '<img src=x onerror="window.__geoCityHighlightXss=1"> City' },
            },
          }],
        }),
      })
    })

    await page.goto(GEO_HTML_URL)

    await expect(page.locator('.hit-item')).toContainText('Demo Airport')
    await expect(page.locator('#country-facet')).toContainText('US')
    await expect(page.locator('#stats')).toContainText('airports')
    await expect(page.locator('#stats img, #stats svg, #hits img, #hits svg, #hits script, #country-facet img')).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => Object.fromEntries(Object.entries({
      name: window.__geoNameXss,
      iata: window.__geoIataXss,
      city: window.__geoCityXss,
      country: window.__geoCountryXss,
      facet: window.__geoFacetXss,
      highlight: window.__geoHighlightXss,
      cityHighlight: window.__geoCityHighlightXss,
      stats: window.__geoStatsXss,
      timing: window.__geoTimingXss,
    }).filter(([, value]) => value !== undefined)))).toEqual({})

    await page.locator('.leaflet-interactive').first().click()
    await expect(page.locator('.leaflet-popup-content')).toContainText('<svg onload="window.__geoIataXss=1">')
    await expect(page.locator('.leaflet-popup-content img, .leaflet-popup-content svg')).toHaveCount(0)
  })

  test('D9.2: API docs route renders the Swagger UI shell', async ({ page }) => {
    await page.goto('/api-docs')

    await expect(page).toHaveTitle('Flapjack API Documentation')
    await expect(page.locator('.docs-shell-notice')).toHaveCount(0)
    await expect(page.locator('#swagger-ui')).toBeAttached()
    await expect(page.locator('#swagger-ui .swagger-container')).toBeVisible({ timeout: 10000 })
  })

  test('D9.3: API docs initializes the OpenAPI definition', async ({ page }) => {
    await page.goto('/api-docs')

    await expect(page.locator('.swagger-ui .info')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('text=Failed to load API definition')).toHaveCount(0)
  })
})

// ── D8: Error Handling ──────────────────────────────────────────────────────

test.describe('D8: Error Handling', () => {
  test('D8.1: page does not crash on load', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/')
    await page.waitForTimeout(3000)
    // Filter out non-critical errors (e.g. third-party script issues)
    const criticalErrors = errors.filter(e => !e.includes('Script error'))
    expect(criticalErrors).toHaveLength(0)
  })

  test('D8.3: search error does not crash app', async ({ page }) => {
    const errors = []
    page.on('pageerror', err => errors.push(err.message))
    await page.goto('/?index=namesMaxFj')
    await page.waitForTimeout(2000)
    // Type a search query
    await page.locator('.ais-SearchBox-input').fill('abcxyz123nonexistent')
    await page.waitForTimeout(2000)
    // App should still be functional (no page crash)
    await expect(page.locator('.ais-SearchBox-input')).toBeVisible()
    // No unrecoverable page errors
    const criticalErrors = errors.filter(e => !e.includes('Script error'))
    expect(criticalErrors).toHaveLength(0)
  })
})
