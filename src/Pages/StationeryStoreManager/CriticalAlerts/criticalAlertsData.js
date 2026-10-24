import {
    ensureCampusSeed,
    hydrateCampusKey,
    persistCampusJson,
    usesCampusApiForKey,
} from '../../../services/campusJsonStore'
import { getInventoryItems, hydrateInventoryItemsFromApi } from '../Inventory/inventoryData'

export const CRITICAL_ALERTS_STORAGE_KEY = 'schoolerp-stationery-critical-alerts-v1'

const seedFor = () => (usesCampusApiForKey(CRITICAL_ALERTS_STORAGE_KEY) ? [] : [])

export function getStationeryCriticalAlerts() {
    return ensureCampusSeed(CRITICAL_ALERTS_STORAGE_KEY, seedFor())
}

export function saveStationeryCriticalAlerts(rows) {
    return persistCampusJson(CRITICAL_ALERTS_STORAGE_KEY, rows)
}

export function hydrateStationeryCriticalAlertsFromApi() {
    if (!usesCampusApiForKey(CRITICAL_ALERTS_STORAGE_KEY)) return Promise.resolve(false)
    return hydrateCampusKey(CRITICAL_ALERTS_STORAGE_KEY, [])
}

export function deriveStationeryAlerts(items = getInventoryItems()) {
    return (Array.isArray(items) ? items : [])
        .filter((item) => {
            const qty = Number(item.availableQuantity)
            const reorder = Number(item.reorderLevel)
            return item.status === 'Low Stock'
                || item.status === 'Out of Stock'
                || (Number.isFinite(qty) && Number.isFinite(reorder) && qty <= reorder)
        })
        .map((item) => {
            const actual = Number(item.availableQuantity) || 0
            const required = Number(item.reorderLevel) || 0
            const out = item.status === 'Out of Stock' || actual <= 0
            return {
                id: item.itemId || item.itemName,
                module: item.category || 'Stationery',
                item: item.itemName,
                itemId: item.itemId || '',
                required,
                actual,
                difference: actual - required,
                status: out ? 'CRITICAL' : 'LOW',
                updatedAt: new Date().toISOString(),
            }
        })
}

export async function syncStationeryCriticalAlerts() {
    await hydrateInventoryItemsFromApi()
    if (usesCampusApiForKey(CRITICAL_ALERTS_STORAGE_KEY)) {
        await hydrateCampusKey(CRITICAL_ALERTS_STORAGE_KEY, [])
    }
    const alerts = deriveStationeryAlerts(getInventoryItems())
    const result = await saveStationeryCriticalAlerts(alerts)
    return { ...result, alerts }
}
