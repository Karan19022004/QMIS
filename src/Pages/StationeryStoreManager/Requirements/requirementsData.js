import {
    ensureCampusSeed,
    hydrateCampusKey,
    persistCampusJson,
    usesCampusApiForKey,
} from '../../../services/campusJsonStore'
import { nextSerial } from '../../../Common/demoDomain/storage'

export const REQUIREMENTS_STORAGE_KEY = 'schoolerp-stationery-requirements-v1'

const DEMO_REQUIREMENTS = [
    {
        id: 'REQ-ST-2026-0001',
        item: 'A4 Paper Ream (500 sheets)',
        quantity: 40,
        requestedBy: 'Stores Manager',
        department: 'Stores',
        requiredDate: '2026-09-30',
        remarks: 'Exam week restock',
        status: 'Pending',
        year: '2026-27',
        planType: 'Annual minimum order',
        vendor: '',
    },
]

const seedFor = () => (usesCampusApiForKey(REQUIREMENTS_STORAGE_KEY) ? [] : DEMO_REQUIREMENTS)

export function getStationeryRequirements() {
    return ensureCampusSeed(REQUIREMENTS_STORAGE_KEY, seedFor())
}

export function saveStationeryRequirements(rows) {
    return persistCampusJson(REQUIREMENTS_STORAGE_KEY, rows)
}

export function hydrateStationeryRequirementsFromApi() {
    if (!usesCampusApiForKey(REQUIREMENTS_STORAGE_KEY)) return Promise.resolve(false)
    return hydrateCampusKey(REQUIREMENTS_STORAGE_KEY, [])
}

export async function addStationeryRequirement(input) {
    const rows = getStationeryRequirements()
    const record = {
        id: nextSerial('REQ-ST-2026-', rows),
        item: String(input.item || '').trim(),
        quantity: Number(input.quantity) || 0,
        requestedBy: input.requestedBy || 'Stores Manager',
        department: input.department || 'Stores',
        requiredDate: input.requiredDate || '',
        remarks: input.remarks || '',
        status: 'Pending',
        year: input.year || '2026-27',
        planType: input.planType || 'Annual minimum order',
        vendor: '',
        createdAt: new Date().toISOString(),
    }
    const result = await saveStationeryRequirements([record, ...rows])
    return { ...result, record }
}
