import { apiRequest, getAccessToken, isApiEmployeeDirectoryEnabled } from './apiClient'
import { listAdminUsersApi } from './adminUsersApi'
import { fromApiUser } from '../Common/RBAC/createdUsersData'
import {
    buildEmployeeDetailFromUser,
    mapCreatedUserToEmployeeRow,
} from '../Common/EmployeeDatabase/employeeDatabaseData'

/** True when the Administrator Employee Database should read the server (flag on + real session). */
export const canUseEmployeeDirectoryApi = () =>
    isApiEmployeeDirectoryEnabled() && Boolean(getAccessToken())

const DASH = '—'
const text = (value) => {
    const trimmed = String(value ?? '').trim()
    return trimmed || DASH
}

/**
 * Map one HR portal employee (`GET /hr/portal/employees`) to the screen's row + detail shape.
 *
 * This is an explicit allowlist on purpose. The HR payload also carries pay fields and a free-form
 * extra bag; neither is copied, so nothing outside this list can reach the Employee Database
 * screen or its state. Salary is shown as restricted and stays an HR/Finance matter.
 */
export const mapHrEmployee = (item, linkedLogin = null) => {
    const name = text(item.name)
    const role = text(item.role || item.designation)
    const row = {
        id: String(item.id),
        employeeId: String(item.id),
        name,
        department: text(item.department),
        role,
        gender: text(item.gender),
        email: String(item.email || ''),
        mobileNumber: text(item.contact),
        dateOfBirth: text(item.dateOfBirth),
        qualification: text(item.qualification),
        experience: text(item.experience),
        country: DASH,
        state: DASH,
        city: DASH,
        profileImage: null,
        status: text(item.status || 'Active'),
        source: 'hr',
    }
    const detail = {
        ...row,
        firstName: name === DASH ? '' : name,
        middleName: '',
        lastName: '',
        bloodGroup: DASH,
        height: DASH,
        weight: DASH,
        medicalHistory: DASH,
        address: { address: text(item.address), country: DASH, state: DASH, city: DASH, zipCode: DASH },
        contact: {
            mobileNumber: text(item.contact),
            alternativeNumber: text(item.emergencyContact),
            email: String(item.email || ''),
        },
        professionalInfo: {
            qualification: text(item.qualification),
            subject: DASH,
            yearsOfExperience: text(item.experience),
            previousSchool: DASH,
            joiningDate: text(item.joiningDate),
        },
        employmentInfo: {
            employeeType: text(item.employmentType),
            salary: 'Restricted (HR)',
            workShift: DASH,
            assignedClass: DASH,
            assignedSubjects: DASH,
            designation: text(item.designation),
            category: text(item.category),
            reportingManager: text(item.reportingManager),
            status: text(item.status || 'Active'),
        },
        account: {
            username: String(item.email || ''),
            loginNote: linkedLogin
                ? `Login created through User Creation (${linkedLogin.staffCode}, ${linkedLogin.status})`
                : 'Managed by HR',
        },
        documents: { idProof: DASH, qualificationCertificate: DASH, experienceCertificate: DASH },
    }
    return { row, detail }
}

/** Map one /admin/users record (a login with no HR record) using the existing created-user mappers. */
export const mapRbacEmployee = (apiUser) => {
    const record = fromApiUser(apiUser)
    const row = { ...mapCreatedUserToEmployeeRow(record), status: record.status, source: 'rbac' }
    const base = buildEmployeeDetailFromUser(record, row)
    const detail = {
        ...base,
        // User Creation does not capture an employment type; the local builder reuses status for it.
        employmentInfo: { ...base.employmentInfo, employeeType: DASH, status: record.status },
        account: {
            username: record.email,
            loginNote: `Created through User Creation (${record.status})`,
        },
    }
    return { row, detail }
}

const failure = (result) =>
    result.status === 'rejected' ? result.reason?.message || 'Request failed.' : ''

/**
 * Load the directory: HR employees plus logins created through User Creation, merged by email so
 * one person is one row (the HR record wins; the login is noted on it). No new store: both reads
 * are existing endpoints. If one source fails the other is still shown with a warning; if both
 * fail the error is thrown.
 */
export const loadEmployeeDirectory = async () => {
    const [hrResult, userResult] = await Promise.allSettled([
        apiRequest('/hr/portal/employees'),
        listAdminUsersApi(),
    ])
    if (hrResult.status === 'rejected' && userResult.status === 'rejected') {
        throw hrResult.reason
    }

    const warnings = []
    if (hrResult.status === 'rejected') {
        warnings.push(`HR employee records could not be loaded (${failure(hrResult)}).`)
    }
    if (userResult.status === 'rejected') {
        warnings.push(`Logins created through User Creation could not be loaded (${failure(userResult)}).`)
    }

    const hrItems = hrResult.status === 'fulfilled' ? hrResult.value : []
    const users = userResult.status === 'fulfilled' ? userResult.value : []
    const usersByEmail = new Map(users.map((user) => [String(user.email).toLowerCase(), user]))
    const hrEmails = new Set(hrItems.map((item) => String(item.email || '').toLowerCase()))

    const records = [
        ...hrItems.map((item) => {
            const login = usersByEmail.get(String(item.email || '').toLowerCase())
            return mapHrEmployee(item, login ? { staffCode: login.staffCode, status: login.status } : null)
        }),
        ...users
            .filter((user) => !hrEmails.has(String(user.email).toLowerCase()))
            .map(mapRbacEmployee),
    ]
    return { records, warnings }
}
