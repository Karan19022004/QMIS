import React, { useEffect, useState } from 'react'
import { InfoTile } from '../Components/VehicleShared'
import { canUseOpsApi, listOpsCollectionApi } from '../../../services/opsApi'
import { VEHICLE_INFO_TILES, vehicleStatusBadgeColor } from './vehicleDetailsData'

const emptyDetails = {
    vehicleId: '—',
    vehicleNumber: '—',
    vehicleType: '—',
    vehicleModel: '—',
    seatingCapacity: '—',
    assignedDriver: '—',
    driverContact: '—',
    assignedRoute: '—',
    status: '—',
}

const VehicleDetails = () => {
    const [details, setDetails] = useState(null)
    const [error, setError] = useState('')

    useEffect(() => {
        if (!canUseOpsApi()) {
            setError('Sign in with the school API to see your assigned vehicle.')
            setDetails(emptyDetails)
            return undefined
        }
        let cancelled = false
        Promise.all([
            listOpsCollectionApi('transport-drivers'),
            listOpsCollectionApi('transport-vehicles'),
        ]).then(([drivers, vehicles]) => {
            if (cancelled) return
            const profile = (drivers || [])[0]
            if (!profile) {
                setDetails(emptyDetails)
                setError('No vehicle is assigned to this driver yet.')
                return
            }
            const number = String(profile.vehicleNumber || '')
            const vehicle = (vehicles || []).find((row) => String(row.vehicleNumber || '') === number) || {}
            setError('')
            setDetails({
                vehicleId: vehicle.id || profile.id || '—',
                vehicleNumber: number || vehicle.vehicleNumber || '—',
                vehicleType: vehicle.vehicleType || profile.vehicleType || '—',
                vehicleModel: vehicle.vehicleModel || vehicle.model || '—',
                seatingCapacity: vehicle.seatingCapacity || vehicle.capacity || '—',
                assignedDriver: [profile.firstName, profile.lastName].filter(Boolean).join(' ') || profile.name || '—',
                driverContact: profile.mobileNumber || profile.phone || '—',
                assignedRoute: profile.routeAssigned || profile.routeName || '—',
                status: vehicle.status || profile.status || 'Active',
            })
        }).catch((err) => {
            if (cancelled) return
            setDetails(emptyDetails)
            setError(err?.message || 'Assigned vehicle could not be loaded.')
        })
        return () => { cancelled = true }
    }, [])

    return (
        <section className='space-y-6'>
            <div className='bg-white rounded-2xl shadow-md p-4 md:p-6'>
                <div className='mb-6'>
                    <h2 className='text-xl font-semibold text-[#515DEF]'>Vehicle Details</h2>
                    <p className='text-sm text-[#667085] mt-1'>Assigned vehicle information and specifications</p>
                </div>
                {error && <p className='text-sm text-[#667085] mb-4'>{error}</p>}
                {details && (
                    <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'>
                        {VEHICLE_INFO_TILES.map((tile) => (
                            <InfoTile
                                key={tile.key}
                                icon={tile.icon}
                                label={tile.label}
                                value={details[tile.key]}
                                iconTone={tile.iconTone}
                                isStatus={tile.isStatus}
                                statusClassName={vehicleStatusBadgeColor[details.status]}
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    )
}

export default VehicleDetails
