import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import StopDetailsForm from './StopDetailsForm'
import { computeRouteDistanceFromStops } from '../../../../Common/Transport/routeDistance'
import { ensureStopCoordinates } from '../../../../Common/Transport/resolveRouteStops'
import { SCHOOL_CAMPUS } from '../../../../Common/Transport/schoolCampusLocation'

const createEmptyStop = () => ({
    key: `stop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startLocation: '',
    endLocation: '',
    pickUpTime: '',
    dropTime: '',
    pickupMapsUrl: '',
    pickupLat: '',
    pickupLng: '',
})

const toEditableStops = (stops) => {
    if (Array.isArray(stops) && stops.length > 0) {
        return stops.map((stop, index) => ({
            ...createEmptyStop(),
            startLocation: stop.startLocation ?? '',
            endLocation: stop.endLocation ?? '',
            pickUpTime: stop.pickUpTime ?? '',
            dropTime: stop.dropTime ?? '',
            pickupMapsUrl: stop.pickupMapsUrl || stop.mapsUrl || '',
            pickupLat: stop.pickupLat ?? stop.startLat ?? '',
            pickupLng: stop.pickupLng ?? stop.startLng ?? '',
            key: stop.key || `stop-seed-${index}`,
        }))
    }
    return [createEmptyStop()]
}

const stripStop = (stop, routeDestinationName) => ({
    startLocation: String(stop.startLocation ?? '').trim(),
    endLocation: String(routeDestinationName || stop.endLocation || '').trim(),
    pickUpTime: String(stop.pickUpTime ?? '').trim(),
    dropTime: String(stop.dropTime ?? '').trim(),
    pickupMapsUrl: String(stop.pickupMapsUrl ?? '').trim(),
    pickupLat: stop.pickupLat === '' || stop.pickupLat == null ? '' : Number(stop.pickupLat),
    pickupLng: stop.pickupLng === '' || stop.pickupLng == null ? '' : Number(stop.pickupLng),
    startLat: stop.pickupLat === '' || stop.pickupLat == null ? '' : Number(stop.pickupLat),
    startLng: stop.pickupLng === '' || stop.pickupLng == null ? '' : Number(stop.pickupLng),
})

const RouteStopsEditor = forwardRef(({
    initialStops,
    routeDestinationName = SCHOOL_CAMPUS.name,
    destinationLat = SCHOOL_CAMPUS.lat,
    destinationLng = SCHOOL_CAMPUS.lng,
    onRouteMetricsChange,
}, ref) => {
    const [stops, setStops] = useState(() => toEditableStops(initialStops))

    const metrics = useMemo(() => computeRouteDistanceFromStops(stops, {
        lat: destinationLat,
        lng: destinationLng,
    }), [stops, destinationLat, destinationLng])

    useEffect(() => {
        const filledStops = stops.filter((stop) => (
            String(stop.startLocation || '').trim()
            || stop.pickupLat !== ''
            || String(stop.pickupMapsUrl || '').trim()
        )).length
        onRouteMetricsChange?.({
            ...metrics,
            totalStops: filledStops || stops.length,
        })
    }, [metrics, onRouteMetricsChange, stops])

    useImperativeHandle(ref, () => ({
        getStops: () => stops.map((stop) => stripStop(stop, routeDestinationName)).filter((stop) => (
            stop.startLocation
            || stop.pickupMapsUrl
            || stop.pickUpTime
            || stop.dropTime
            || stop.pickupLat !== ''
        )),
        /** Resolves Maps links → lat/lng before save so Track Bus can show every stop. */
        getStopsResolved: async () => {
            const raw = stops.map((stop) => stripStop(stop, routeDestinationName)).filter((stop) => (
                stop.startLocation
                || stop.pickupMapsUrl
                || stop.pickUpTime
                || stop.dropTime
                || stop.pickupLat !== ''
            ))
            const resolved = await ensureStopCoordinates(raw)
            return resolved.map((stop) => stripStop({
                ...stop,
                pickupLat: stop.pickupLat ?? '',
                pickupLng: stop.pickupLng ?? '',
            }, routeDestinationName))
        },
        getStopCount: () => stops.length,
        getRouteMetrics: () => computeRouteDistanceFromStops(stops, {
            lat: destinationLat,
            lng: destinationLng,
        }),
    }))

    const updateStop = (index, key, value) => {
        setStops((prev) => prev.map((stop, i) => (
            i === index ? { ...stop, [key]: value } : stop
        )))
    }

    const addStop = () => {
        setStops((prev) => [...prev, createEmptyStop()])
    }

    const removeStop = (index) => {
        setStops((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)))
    }

    return (
        <div>
            <div className='flex flex-wrap items-center justify-between gap-3'>
                <div>
                    <h2 className='text-xl font-semibold text-black'>Add Stops</h2>
                    <p className='text-xs text-[#667085] mt-0.5'>
                        Add a pickup Google Maps link per stop. Destination stays the route school pin
                        ({routeDestinationName}).
                    </p>
                </div>
                <button
                    type='button'
                    onClick={addStop}
                    className='inline-flex items-center gap-2 bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md hover:opacity-90 transition-all duration-200 cursor-pointer'
                >
                    <Plus size={16} />
                    Add Stop
                </button>
            </div>

            <div className='mt-4 rounded-xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-3 text-sm text-[#0C1E5B]'>
                {metrics.km != null ? (
                    <>
                        <span className='font-semibold'>Auto distance: {metrics.label}</span>
                        <span className='text-[#667085]'>
                            {' '}· {metrics.pinnedStops} pickup pin{metrics.pinnedStops === 1 ? '' : 's'}
                            → school
                            {metrics.estimatedTimeLabel ? ` · ~${metrics.estimatedTimeLabel}` : ''}
                        </span>
                        <p className='text-xs text-[#667085] mt-1'>
                            Fills Distance / Estimated Time on the route form from the Maps pins (straight-line path via each stop).
                        </p>
                    </>
                ) : (
                    <span className='text-[#667085]'>
                        Paste Google Maps links on each pickup stop to auto-calculate route distance.
                        {metrics.pinnedStops > 0
                            ? ` (${metrics.pinnedStops} pin${metrics.pinnedStops === 1 ? '' : 's'} set — need school destination pin too.)`
                            : ''}
                    </span>
                )}
            </div>

            {stops.map((stop, index) => (
                <StopDetailsForm
                    key={stop.key}
                    stop={stop}
                    index={index}
                    canRemove={stops.length > 1}
                    routeDestinationName={routeDestinationName}
                    onChange={(key, value) => updateStop(index, key, value)}
                    onRemove={() => removeStop(index)}
                />
            ))}
        </div>
    )
})

RouteStopsEditor.displayName = 'RouteStopsEditor'

export default RouteStopsEditor
