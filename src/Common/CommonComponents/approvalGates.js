import { ROLES } from '../../constants/roles'

const normalizeRole = (role) =>
    String(role || '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '')

/**
 * Roles that edit/delete directly — never "Send Request to Super Admin".
 * Matches Academic Calendar / Class Timetable behaviour.
 */
const DIRECT_MUTATION_ROLES = new Set([
    normalizeRole(ROLES.SUPER_ADMIN),
    normalizeRole(ROLES.ADMIN),
    normalizeRole(ROLES.PRINCIPAL),
    normalizeRole(ROLES.DIRECTOR),
    normalizeRole(ROLES.COORDINATOR),
    normalizeRole(ROLES.JOINT_DIRECTOR),
    normalizeRole(ROLES.JOINT_DIRECTOR_ASSISTANT),
    normalizeRole(ROLES.JOINT_DIRECTOR_AUDIT),
    normalizeRole(ROLES.HR),
    normalizeRole(ROLES.ACCOUNT_HEAD),
    normalizeRole(ROLES.FINANCE_ASSISTANT),
    normalizeRole(ROLES.PRM),
    normalizeRole(ROLES.GATEKEEPER_MANAGER),
    normalizeRole(ROLES.CANTEEN_MANAGER),
    normalizeRole(ROLES.IT_SUPPORT_MANAGER),
    normalizeRole(ROLES.STATIONERY_STORE_MANAGER),
    normalizeRole(ROLES.HOUSEKEEPING_MANAGER),
    normalizeRole(ROLES.TRANSPORT_MANAGER),
    'superadmin',
])

export const canEditWithoutApproval = (role) => DIRECT_MUTATION_ROLES.has(normalizeRole(role))

export const canDeleteWithoutApproval = (role) => canEditWithoutApproval(role)

export const requiresEditApproval = (role) => !canEditWithoutApproval(role)
