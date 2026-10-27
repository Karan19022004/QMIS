import { ensureSeed, saveJson } from './storage'
import { hydrateCampusKey, persistCampusJson, usesCampusApiForKey } from '../../services/campusJsonStore'
import { logActivity } from './activityLog'

export const BIOMETRIC_KEY = 'schoolerp-biometric-attendance-v1'

const seed = [
    { id: 'BIO-0001', person: 'Aarav Sharma', role: 'Student', grade: '10', section: 'A', date: '2026-09-23', punchTime: '08:05', biometricStatus: 'Present', finalStatus: 'Present', changedBy: '', changedAt: '', reason: '', source: 'ESSL' },
    { id: 'BIO-0002', person: 'Diya Menon', role: 'Student', grade: '10', section: 'A', date: '2026-09-23', punchTime: '', biometricStatus: 'Absent', finalStatus: 'Absent', changedBy: '', changedAt: '', reason: '', source: 'ESSL' },
    { id: 'BIO-0003', person: 'Priya Nair', role: 'Teacher', grade: '', section: '', date: '2026-09-23', punchTime: '07:52', biometricStatus: 'Present', finalStatus: 'Present', changedBy: '', changedAt: '', reason: '', source: 'ESSL' },
]

export function getBiometricRows() {
    return ensureSeed(BIOMETRIC_KEY, seed)
}

export async function hydrateBiometricFromApi() {
    if (!usesCampusApiForKey(BIOMETRIC_KEY)) return false
    return hydrateCampusKey(BIOMETRIC_KEY, seed)
}

// In API mode a save replaces the whole server collection, so rows must be loaded first and an
// empty list is never written back.
async function loadedRows() {
    if (usesCampusApiForKey(BIOMETRIC_KEY)) {
        const ok = await hydrateBiometricFromApi()
        if (!ok) return { rows: getBiometricRows(), loaded: false }
    }
    return { rows: getBiometricRows(), loaded: true }
}

async function persistRows(rows) {
    if (usesCampusApiForKey(BIOMETRIC_KEY)) return persistCampusJson(BIOMETRIC_KEY, rows)
    return { success: Boolean(saveJson(BIOMETRIC_KEY, rows)), api: false }
}

export async function syncBiometricDemo() {
    const { rows, loaded } = await loadedRows()
    if (!loaded) return { success: false, rows, message: 'Could not load biometric records from the server.' }
    if (!rows.length) {
        return { success: false, rows, message: 'No biometric punches to sync yet. The attendance device import is not connected.' }
    }
    const now = new Date().toISOString()
    const stamped = rows.map((row) => (
        row.changedBy
            ? { ...row, lastSync: now }
            : { ...row, source: 'ESSL', lastSync: now, biometricStatus: row.biometricStatus || 'Present' }
    ))
    const saved = await persistRows(stamped)
    if (!saved.success) return { success: false, rows, message: saved.message || 'Could not save the biometric sync.' }
    logActivity({ action: 'UPDATE', module: 'ESSL Demo Sync', details: 'Deterministic biometric punches loaded' })
    return { success: true, rows: stamped }
}

export async function overrideAttendance(id, finalStatus, changedBy, reason) {
    const { rows, loaded } = await loadedRows()
    if (!loaded) return { success: false, rows, message: 'Could not load biometric records from the server.' }
    if (!rows.some((row) => row.id === id)) return { success: false, rows, message: 'This record no longer exists. Refresh the page.' }
    const next = rows.map((row) => (
        row.id === id
            ? { ...row, finalStatus, changedBy, changedAt: new Date().toISOString(), reason }
            : row
    ))
    const saved = await persistRows(next)
    if (!saved.success) return { success: false, rows, message: saved.message || 'Could not save the override.' }
    logActivity({ actor: changedBy, action: 'UPDATE', module: 'Attendance Override', recordId: id, after: finalStatus, reason })
    return { success: true, rows: next }
}
