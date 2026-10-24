import {
    ensureCampusSeed,
    hydrateCampusKey,
    persistCampusJson,
    usesCampusApiForKey,
} from '../../../services/campusJsonStore'
import { nextSerial } from '../../../Common/demoDomain/storage'

export const REQUIREMENTS_STORAGE_KEY = 'schoolerp-hk-inventory-requirements-v1'

const DEMO_REQUIREMENTS = [
    {
        id: 'REQ-HK-INV-0001',
        item: 'Floor Cleaner — Lemon (5L)',
        quantity: 20,
        requestedBy: 'Housekeeping Manager',
        department: 'Housekeeping',
        requiredDate: '2026-09-30',
        remarks: 'Monthly deep clean',
        status: 'Pending',
        year: '2026-27',
        planType: 'Annual minimum order',
        vendor: '',
    },
]

const seedFor = () => (usesCampusApiForKey(REQUIREMENTS_STORAGE_KEY) ? [] : DEMO_REQUIREMENTS)

export function getHkInventoryRequirements() {
    return ensureCampusSeed(REQUIREMENTS_STORAGE_KEY, seedFor())
}

export function saveHkInventoryRequirements(rows) {
    return persistCampusJson(REQUIREMENTS_STORAGE_KEY, rows)
}

export function hydrateHkInventoryRequirementsFromApi() {
    if (!usesCampusApiForKey(REQUIREMENTS_STORAGE_KEY)) return Promise.resolve(false)
    return hydrateCampusKey(REQUIREMENTS_STORAGE_KEY, [])
}

export async function addHkInventoryRequirement(input) {
    const rows = getHkInventoryRequirements()
    const record = {
        id: nextSerial('REQ-HK-INV-', rows),
        item: String(input.item || '').trim(),
        quantity: Number(input.quantity) || 0,
        requestedBy: input.requestedBy || 'Housekeeping Manager',
        department: 'Housekeeping',
        requiredDate: input.requiredDate || '',
        remarks: input.remarks || '',
        status: 'Pending',
        year: input.year || '2026-27',
        planType: input.planType || 'Annual minimum order',
        vendor: '',
        createdAt: new Date().toISOString(),
    }
    const result = await saveHkInventoryRequirements([record, ...rows])
    return { ...result, record }
}
