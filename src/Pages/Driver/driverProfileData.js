import { getDrivers, hydrateDriversFromApi } from '../TransportManager/DriverManagement/driverManagementData'
import { getVehicles, hydrateVehiclesFromApi } from '../TransportManager/VehicleManagement/vehicleManagementData'
import { getRoutes, hydrateRoutesFromApi } from '../TransportManager/RouteManagement/routeManagementData'
import {
    getStudentTransports,
    hydrateStudentTransportsFromApi,
} from '../TransportManager/StudentTransport/studentTransportData'
import { getDuties, hydrateDutiesFromApi } from '../TransportManager/AssignDuty/assignDutyData'

const plateKey = (value) => String(value || '').replace(/[\s-]/g, '').toUpperCase()

export function driverDisplayName(row) {
    if (!row) return ''
    const joined = [row.firstName, row.middleName, row.lastName].filter(Boolean).join(' ').trim()
    return joined || row.driverName || row.name || ''
}

export async function hydrateDriverProfileSources() {
    await Promise.all([
        hydrateDriversFromApi(),
        hydrateVehiclesFromApi(),
        hydrateRoutesFromApi(),
        hydrateStudentTransportsFromApi(),
        hydrateDutiesFromApi(),
    ])
    return true
}

/**
 * Resolve the signed-in driver's profile, vehicle, route, and enrolled students.
 */
export function resolveDriverProfile(userEmail = '') {
    const email = String(userEmail || '').trim().toLowerCase()
    const drivers = getDrivers()
    let profile = email
        ? drivers.find((row) => String(row.email || '').trim().toLowerCase() === email)
        : null
    if (!profile && drivers.length === 1) profile = drivers[0]

    const vehicleNumber = profile?.vehicleNumber || ''
    const vehicles = getVehicles()
    const vehicle = vehicles.find((row) => plateKey(row.vehicleNumber) === plateKey(vehicleNumber))
        || vehicles.find((row) => String(row.assignedDriver || '').trim() === driverDisplayName(profile))
        || null

    const routeName = profile?.routeAssigned || profile?.routeName || vehicle?.routeAssigned || ''
    const routes = getRoutes()
    const route = routes.find((row) => (
        String(row.routeName || '').trim().toLowerCase() === String(routeName || '').trim().toLowerCase()
        || plateKey(row.vehicleNumber) === plateKey(vehicleNumber || vehicle?.vehicleNumber)
        || (profile?.id && String(row.driverId || '') === String(profile.id))
    )) || null

    const resolvedRouteName = route?.routeName || routeName
    const resolvedPlate = vehicle?.vehicleNumber || vehicleNumber
    const students = getStudentTransports().filter((row) => {
        const sameRoute = resolvedRouteName
            && String(row.routeName || '').trim().toLowerCase() === String(resolvedRouteName).trim().toLowerCase()
        const sameVehicle = resolvedPlate
            && plateKey(row.vehicleNumber) === plateKey(resolvedPlate)
        return sameRoute || sameVehicle
    })

    const duties = getDuties().filter((duty) => {
        if (email && String(duty.driverEmail || '').trim().toLowerCase() === email) return true
        if (resolvedPlate && plateKey(duty.vehicleNumber) === plateKey(resolvedPlate)) return true
        if (driverDisplayName(profile) && String(duty.driverName || '') === driverDisplayName(profile)) return true
        return false
    })

    return {
        profile,
        vehicle,
        route,
        students,
        duties,
        driverName: driverDisplayName(profile) || 'Driver',
        driverId: profile?.id || profile?.employeeId || '—',
        driverEmail: profile?.email || email || '',
        driverContact: profile?.mobileNumber || profile?.phone || vehicle?.driverContact || '',
        vehicleNumber: resolvedPlate || '—',
        vehicleId: vehicle?.id || '—',
        routeName: resolvedRouteName || '—',
        routeId: route?.id || '—',
    }
}

export function getDriverDefaultFormValues(userEmail = '') {
    const ctx = resolveDriverProfile(userEmail)
    return {
        vehicleNumber: ctx.vehicleNumber === '—' ? '' : ctx.vehicleNumber,
        driverName: ctx.driverName,
        driverId: ctx.driverId === '—' ? '' : ctx.driverId,
        assignedRoute: ctx.routeName === '—' ? '' : ctx.routeName,
    }
}
