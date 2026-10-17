import React from 'react'
import { RefreshCw } from 'lucide-react'
import BusRouteCard from './Components/BusRouteCard'
import BusTrackingMap from '../../TransportManager/RouteData/Components/BusTrackingMap'
import useProtrackLive from '../../../Common/Transport/useProtrackLive'

const TrackBus = ({ showRouteDetails = false }) => {
    const live = useProtrackLive({ panel: 'parent' })
    const device = live.devices.find((row) => row.imei === live.imei) || live.devices[0]

    return (
        <section>
            {showRouteDetails && <BusRouteCard title="Bus Route Details" />}

            <div className={`bg-white rounded-2xl shadow-md p-4 ${showRouteDetails ? 'mt-8' : ''}`}>
                <div className='flex flex-wrap items-center justify-between gap-3'>
                    <div>
                        <h2 className='text-xl font-medium text-black'>Track Bus Location</h2>
                        <p className='text-sm text-[#667085] mt-1'>
                            Live GPS from ProTrack365 parent panel (polls every 15s).
                        </p>
                    </div>
                    <button
                        type='button'
                        onClick={() => live.refresh()}
                        className='inline-flex items-center gap-2 text-sm text-[#515DEF] border border-[#515DEF] rounded-md px-4 py-2 cursor-pointer'
                    >
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
                {live.error && (
                    <p className='text-sm text-[#B45309] mt-3 bg-[#FFF7ED] border border-[#FDBA74] rounded-md px-3 py-2'>
                        {live.error}
                    </p>
                )}
                {live.devices.length > 0 && (
                    <label className='block mt-3 text-sm text-[#667085] max-w-md'>
                        Bus / device
                        <select
                            className='mt-1 w-full border border-[#D9D9D9] rounded-md px-2 py-2 text-[#1E1E1E]'
                            value={live.imei}
                            onChange={(event) => live.setImei(event.target.value)}
                        >
                            {live.devices.map((row) => (
                                <option key={row.imei} value={row.imei}>
                                    {row.platenumber || row.devicename || row.imei}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>

            <div className='bg-white rounded-2xl shadow-md mt-8 overflow-hidden'>
                <BusTrackingMap
                    routeName={device?.devicename || 'School Bus'}
                    vehicleNumber={device?.platenumber || '—'}
                    driverName='Assigned driver'
                    driverContact=''
                    startLocation='Pickup'
                    endLocation='Queen Mira School'
                    busLabel={device?.platenumber || device?.imei?.slice(-4) || 'BUS'}
                    stats={live.stats}
                    livePosition={live.livePosition}
                    liveStatusLabel={live.liveStatusLabel}
                />
            </div>
        </section>
    )
}

export default TrackBus
