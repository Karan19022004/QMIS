import {
    ensureCampusSeed,
    hydrateCampusKey,
    persistCampusJson,
    usesCampusApiForKey,
} from '../../../services/campusJsonStore'

export const INVENTORY_ITEMS_STORAGE_KEY = 'schoolerp-canteen-inventory-v1'

export const CATEGORIES = ['Grains', 'Essentials', 'Produce', 'Meat', 'Dairy', 'Beverages']
export const UNITS = ['kg', 'L', 'pcs', 'pack']
export const STATUS_OPTIONS = ['In Stock', 'Low Stock', 'Critical']

const DEMO_INVENTORY_ITEMS = [
    { id: 'INV-001', name: 'Basmati Rice', category: 'Grains', quantity: '25', unit: 'kg', reorderLevel: '10', status: 'In Stock' },
    { id: 'INV-002', name: 'Cooking Oil', category: 'Essentials', quantity: '8', unit: 'L', reorderLevel: '15', status: 'Low Stock' },
    { id: 'INV-003', name: 'Fresh Vegetables', category: 'Produce', quantity: '40', unit: 'kg', reorderLevel: '20', status: 'In Stock' },
    { id: 'INV-004', name: 'Chicken (Fresh)', category: 'Meat', quantity: '5', unit: 'kg', reorderLevel: '12', status: 'Critical' },
]

export const statusColor = {
    'In Stock': 'bg-[#4CAF5033] text-[#4CAF50]',
    'Low Stock': 'bg-[#FF980033] text-[#FF9800]',
    Critical: 'bg-[#FF000033] text-[#FF0000]',
}

const seedFor = () => (usesCampusApiForKey(INVENTORY_ITEMS_STORAGE_KEY) ? [] : DEMO_INVENTORY_ITEMS)

export const deriveInventoryStatus = (quantity, reorderLevel) => {
    const qty = Number(quantity)
    const reorder = Number(reorderLevel)
    if (!Number.isFinite(qty)) return 'In Stock'
    if (qty <= 0) return 'Critical'
    if (Number.isFinite(reorder) && qty < reorder) return qty <= reorder / 2 ? 'Critical' : 'Low Stock'
    return 'In Stock'
}

const nextInventoryId = (rows) => {
    const max = rows.reduce((acc, row) => {
        const match = String(row.id || '').match(/(\d+)$/)
        return match ? Math.max(acc, Number(match[1])) : acc
    }, 0)
    return `INV-${String(max + 1).padStart(3, '0')}`
}

export function getInventoryItems() {
    return ensureCampusSeed(INVENTORY_ITEMS_STORAGE_KEY, seedFor())
}

export function saveInventoryItems(rows) {
    return persistCampusJson(INVENTORY_ITEMS_STORAGE_KEY, rows)
}

export function hydrateInventoryItemsFromApi() {
    if (!usesCampusApiForKey(INVENTORY_ITEMS_STORAGE_KEY)) return Promise.resolve(false)
    return hydrateCampusKey(INVENTORY_ITEMS_STORAGE_KEY, [])
}

export async function upsertInventoryItem(payload) {
    const rows = getInventoryItems()
    const id = String(payload.id || nextInventoryId(rows)).trim()
    const quantity = String(payload.quantity ?? '').trim()
    const reorderLevel = String(payload.reorderLevel ?? '').trim()
    const record = {
        id,
        name: String(payload.name || '').trim(),
        category: payload.category || 'Essentials',
        quantity,
        unit: payload.unit || 'kg',
        reorderLevel,
        status: payload.status || deriveInventoryStatus(quantity, reorderLevel),
    }
    const idx = rows.findIndex((row) => String(row.id) === id)
    const next = idx >= 0
        ? rows.map((row, i) => (i === idx ? { ...row, ...record } : row))
        : [record, ...rows]
    const result = await saveInventoryItems(next)
    return { ...result, record }
}
