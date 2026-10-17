import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import BusTrackingMap from './Components/BusTrackingMap'
import { getRouteById, hydrateRoutesFromApi } from '../RouteManagement/routeManagementData'
import useProtrackLive from '../../../Common/Transport/useProtrackLive'

const Field = ({ label, value }) => (
    <div className='flex flex-col gap-y-1'>
        <span className='text-xs font-medium uppercase tracking-wide text-[#808080]'>{label}</span>
        <span className='text-sm text-[#1E1E1E] font-medium'>{value || '—'}</span>
    </div>
)

const TRACKING_PRESETS = [
    { busIndex: 54, stats: { progress: '~55%', distanceLeft: '3.2 km', eta: '~8 min', speed: '32 km/h' } },
    { busIndex: 38, stats: { progress: '~40%', distanceLeft: '4.1 km', eta: '~11 min', speed: '28 km/h' } },
]

const TrackBus = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const [route, setRoute] = useState(() => getRouteById(id))

    useEffect(() => {
        hydrateRoutesFromApi().finally(() => setRoute(getRouteById(id)))
    }, [id])

    const live = useProtrackLive({
        panel: 'admin',
        preferredImei: route?.imei || route?.gpsImei || '',
        preferredPlate: route?.vehicleNumber || '',
    })

    const trackingPreset = TRACKING_PRESETS[(parseInt(route?.id?.split('-')[1] ?? '1', 10) - 1) % TRACKING_PRESETS.length]
    const stats = live.livePosition ? live.stats : trackingPreset.stats

    return (
        <section className='space-y-6'>
            <div className='flex flex-wrap items-center gap-3'>
                <button
                    type='button'
                    onClick={() => navigate('/transport-manager/route-data')}
                    className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 hover:bg-[#515DEF] hover:text-white transition-colors cursor-pointer'
                >
                    <ArrowLeft size={18} />
                    Back to Route Data
                </button>
                <button
                    type='button'
                    onClick={() => live.refresh()}
                    className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#D9D9D9] rounded-md px-4 py-2 cursor-pointer'
                >
                    <RefreshCw size={16} /> Refresh GPS
                </button>
            </div>

            {!route ? (
                <div className='bg-white rounded-2xl shadow-md p-8 text-center text-[#667085]'>
                    Route not found or could not be loaded.
                </div>
            ) : (
                <>
                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <h1 className='text-2xl font-semibold text-black'>{route.routeName}</h1>
                        <p className='text-sm text-[#667085] mt-2'>
                            <span className='font-medium text-[#1E1E1E]'>Route ID: {route.id}</span>
                            {' · '}
                            <span>{route.distance} · {route.estimatedTime}</span>
                        </p>
                        {live.error && (
                            <p className='text-sm text-[#B45309] mt-3 bg-[#FFF7ED] border border-[#FDBA74] rounded-md px-3 py-2'>
                                {live.error} Demo route geometry still shows until ProTrack credentials are set.
                            </p>
                        )}
                        {live.devices.length > 0 && (
                            <label className='block mt-3 text-sm text-[#667085] max-w-md'>
                                ProTrack device
                                <select
                                    className='mt-1 w-full border border-[#D9D9D9] rounded-md px-2 py-2 text-[#1E1E1E]'
                                    value={live.imei}
                                    onChange={(event) => live.setImei(event.target.value)}
                                >
                                    {live.devices.map((device) => (
                                        <option key={device.imei} value={device.imei}>
                                            {(device.platenumber || device.devicename || device.imei)}
                                            {device.platenumber ? ` · ${device.imei}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>

                    <div className='bg-white rounded-2xl shadow-md p-4'>
                        <h2 className='text-lg font-semibold text-black mb-4'>Route Details</h2>
                        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'>
                            <Field label='Vehicle Number' value={route.vehicleNumber} />
                            <Field label='Vehicle ID' value={route.vehicleId} />
                            <Field label='Driver Name' value={route.driverName} />
                            <Field label='Driver Contact' value={route.driverContact} />
                            <Field label='Start Location' value={route.startLocation} />
                            <Field label='End Location' value={route.endLocation} />
                            <Field label='IMEI' value={live.imei || route.imei || '—'} />
                            <Field label='GPS Status' value={live.liveStatusLabel || (live.loading ? 'Loading…' : 'Demo')} />
                        </div>
                    </div>

                    <div className='bg-white rounded-2xl shadow-md overflow-hidden'>
                        <BusTrackingMap
                            routeName={route.routeName}
                            vehicleNumber={route.vehicleNumber}
                            driverName={route.driverName}
                            driverContact={route.driverContact}
                            startLocation={route.startLocation}
                            startSubtitle='Pickup Point'
                            endLocation={route.endLocation}
                            endSubtitle='School Campus'
                            busLabel={route.vehicleId}
                            stats={stats}
                            busIndex={trackingPreset.busIndex}
                            livePosition={live.livePosition}
                            liveStatusLabel={live.liveStatusLabel}
                        />
                    </div>
                </>
            )}
        </section>
    )
}

export default TrackBus
