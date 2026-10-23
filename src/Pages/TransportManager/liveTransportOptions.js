import { getDriverDisplayName, getDrivers, hydrateDriversFromApi } from './DriverManagement/driverManagementData'
import { getRoutes, hydrateRoutesFromApi } from './RouteManagement/routeManagementData'
import { getVehicles, hydrateVehiclesFromApi } from './VehicleManagement/vehicleManagementData'

const driverLabel = (driver) => {
    const named = getDriverDisplayName(driver)
    return named || driver.driverName || driver.name || driver.email || driver.id || ''
}

export async function loadTransportChoices() {
    await Promise.all([
        hydrateDriversFromApi(),
        hydrateVehiclesFromApi(),
        hydrateRoutesFromApi(),
    ])
    return {
        drivers: getDrivers()
            .map((driver) => ({
                id: driver.id,
                label: driverLabel(driver),
                vehicleNumber: driver.vehicleNumber || '',
                routeName: driver.routeAssigned || driver.routeName || '',
                contact: driver.mobileNumber || driver.driverContact || driver.phone || '',
            }))
            .filter((driver) => driver.label),
        vehicles: getVehicles()
            .map((vehicle) => ({
                id: vehicle.id,
                label: vehicle.vehicleNumber,
                vehicleNumber: vehicle.vehicleNumber,
                vehicleType: vehicle.vehicleType || '',
                driverName: vehicle.driverName || '',
                driverContact: vehicle.driverContact || '',
            }))
            .filter((vehicle) => vehicle.vehicleNumber),
        routes: getRoutes()
            .map((route) => ({
                id: route.id,
                label: route.routeName,
                vehicleNumber: route.vehicleNumber || '',
                startLocation: route.startLocation || '',
                endLocation: route.endLocation || '',
                supportStaff: route.supportStaff || '',
                driverName: route.driverName || '',
                driverContact: route.driverContact || '',
                pickUpTime: route.pickUpTime || '',
                dropTime: route.dropTime || '',
            }))
            .filter((route) => route.label),
    }
}
