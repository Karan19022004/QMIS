import React, { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import BusRouteCard from './Components/BusRouteCard'
import BusTrackingMap from '../../TransportManager/RouteData/Components/BusTrackingMap'
import useProtrackLive from '../../../Common/Transport/useProtrackLive'
import { useActiveStudent } from '../../../context/ActiveStudentContext'
import { apiRequest, getAccessToken, isApiAuthEnabled } from '../../../services/apiClient'
import { hydrateStudentBusAssignment } from './studentBusAssignment'

/**
 * Parent/student track view.
 * Prefer GET /ops/my-transport for plate/IMEI; fall back to campus hydrate.
 * Live GPS only when assigned vehicle matches a ProTrack device (no wrong-bus fallback).
 */
const TrackBus = ({ showRouteDetails = false }) => {
    const { activeStudent } = useActiveStudent()
    const [assignment, setAssignment] = useState(null)
    const [preferredImei, setPreferredImei] = useState('')
    const [preferredPlate, setPreferredPlate] = useState('')
    const [loadingAssignment, setLoadingAssignment] = useState(true)

    useEffect(() => {
        let cancelled = false
        setLoadingAssignment(true)

        const applyLocal = async () => {
            const view = await hydrateStudentBusAssignment(activeStudent)
            if (cancelled) return
            setAssignment(view)
            setPreferredImei(String(view?.imei || ''))
            setPreferredPlate(String(view?.vehicleNumber || ''))
        }

        ;(async () => {
            try {
                if (isApiAuthEnabled() && getAccessToken()) {
                    try {
                        const payload = await apiRequest('/ops/my-transport')
                        if (cancelled) return
                        const keys = new Set([
                            String(activeStudent?.id || ''),
                            String(activeStudent?.admissionNumber || activeStudent?.admissionNo || ''),
                        ].filter(Boolean))
                        const rows = payload?.assignments || []
                        const match = rows.find((row) => keys.has(String(row.studentId || row.student_id || ''))) || null
                        const routeId = String(match?.routeId || match?.route || '')
                        const foundRoute = (payload?.routes || []).find((row) => (
                            String(row.id || '') === routeId
                            || String(row.routeName || row.name || '') === routeId
                        )) || null
                        if (match) {
                            const view = {
                                id: match.id,
                                routeId: match.routeId || foundRoute?.id || '',
                                routeName: match.routeName || foundRoute?.routeName || foundRoute?.name || 'Assigned route',
                                vehicleNumber: match.vehicleNumber || match.vehicle || foundRoute?.vehicleNumber || '—',
                                vehicleId: match.vehicleId || foundRoute?.vehicleId || '—',
                                driverName: match.driverName || foundRoute?.driverName || 'Assigned driver',
                                driverContact: match.driverContact || foundRoute?.driverContact || '',
                                pickupLocation: match.startLocation || match.stopName || match.pickupPoint || foundRoute?.startLocation || 'Pickup',
                                pickupTime: match.pickUpTime || foundRoute?.pickUpTime || '—',
                                dropLocation: match.dropLocation || match.startLocation || match.stopName || '—',
                                dropTime: match.dropTime || foundRoute?.dropTime || '—',
                                endLocation: match.endLocation || foundRoute?.endLocation || 'School',
                                routeStops: Array.isArray(foundRoute?.stops)
                                    ? foundRoute.stops.map((s) => s.startLocation || s.label).filter(Boolean).join(', ')
                                    : '—',
                                imei: match.imei || match.gpsImei || foundRoute?.imei || foundRoute?.gpsImei || '',
                            }
                            setAssignment(view)
                            setPreferredImei(String(view.imei || ''))
                            setPreferredPlate(String(view.vehicleNumber || ''))
                            return
                        }
                    } catch {
                        /* fall through to campus hydrate */
                    }
                }
                await applyLocal()
            } finally {
                if (!cancelled) setLoadingAssignment(false)
            }
        })()

        return () => { cancelled = true }
    }, [activeStudent])

    const live = useProtrackLive({
        panel: 'parent',
        preferredImei,
        preferredPlate,
        fallbackPanel: 'admin',
    })

    const device = live.imei
        ? live.devices.find((row) => String(row.imei) === String(live.imei))
        : null
    const hasLiveGps = Boolean(live.livePosition)
    const vehicleNumber = assignment?.vehicleNumber || device?.platenumber || preferredPlate || '—'
    const driverName = assignment?.driverName || 'Assigned driver'
    const driverContact = assignment?.driverContact || ''
    const routeName = assignment?.routeName || device?.devicename || 'School Bus'

    return (
        <section>
            {showRouteDetails && <BusRouteCard title='Bus Route Details' />}

            <div className={`bg-white rounded-2xl shadow-md p-4 ${showRouteDetails ? 'mt-8' : ''}`}>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div>
                        <h2 className='text-xl font-medium text-black'>Track Bus Location</h2>
                        <p className='text-sm text-[#667085] mt-1'>
                            {hasLiveGps
                                ? (assignment
                                    ? `Live GPS for ${assignment.vehicleNumber} on ${assignment.routeName} (polls every 15s).`
                                    : 'Live GPS from ProTrack365 (polls every 15s).')
                                : 'Live GPS is off until a verified vehicle–IMEI mapping and a current fix are available. Demo route geometry is not a live position.'}
                        </p>
                    </div>
                    <button
                        type='button'
                        onClick={() => live.refresh()}
                        disabled={!live.imei}
                        className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 cursor-pointer disabled:opacity-50'
                    >
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
                {!loadingAssignment && !assignment && (
                    <p className='text-sm text-[#667085] mt-3 bg-[#F9FAFB] border border-[#E0E0E0] rounded-md px-3 py-2'>
                        No transport enrollment found for this student. Route details and vehicle-matched GPS appear after Transport Manager assigns a route.
                    </p>
                )}
                {live.error && (
                    <p className='text-sm text-[#B45309] mt-3 bg-[#FFF7ED] border border-[#FDBA74] rounded-md px-3 py-2'>
                        {live.error}
                    </p>
                )}
                {live.imei && device && (
                    <p className='text-sm text-[#667085] mt-3'>
                        Mapped device: {device.platenumber || device.devicename || device.imei}
                        {device.imei ? ` · IMEI ${device.imei}` : ''}
                    </p>
                )}
            </div>

            <div className='bg-white rounded-2xl shadow-md mt-8 overflow-hidden'>
                <BusTrackingMap
                    routeName={routeName}
                    vehicleNumber={vehicleNumber}
                    driverName={driverName}
                    driverContact={driverContact}
                    startLocation={assignment?.pickupLocation || 'Pickup'}
                    endLocation={assignment?.endLocation || 'School'}
                    busLabel={assignment?.vehicleId || vehicleNumber || 'BUS'}
                    stats={
                        hasLiveGps
                            ? live.stats
                            : {
                                progress: '—',
                                distanceLeft: 'Demo route only — not live GPS',
                                eta: '—',
                                speed: '—',
                            }
                    }
                    livePosition={live.livePosition}
                    liveStatusLabel={live.liveStatusLabel}
                    trackingMode={hasLiveGps ? 'live' : 'demo'}
                />
            </div>
        </section>
    )
}

export default TrackBus
