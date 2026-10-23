import { ensureCampusSeed, hydrateCampusKey, saveCampusJson, usesCampusApiForKey } from '../../../services/campusJsonStore'

const STORAGE_KEY = 'schoolerp-jd-audit-assignments-v1'

export const ASSIGNMENT_STATUSES = ['Assigned', 'In progress', 'Submitted', 'Closed']

export function getAssignments() {
    return ensureCampusSeed(STORAGE_KEY, [])
}

export function saveAssignments(rows) {
    return saveCampusJson(STORAGE_KEY, rows)
}

export function hydrateAssignments() {
    if (!usesCampusApiForKey(STORAGE_KEY)) return Promise.resolve(false)
    return hydrateCampusKey(STORAGE_KEY, [])
}
