import React, { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Bus, ClipboardList, Fuel, MapPin, Route, Wrench } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { hydrateDriverProfileSources, resolveDriverProfile } from './driverProfileData'
import { getMyDuties, hydrateMyDutiesFromApi } from './MyDuty/myDutyData'
import { isDutyDateToday, isDutyTrackingActive } from '../../Common/Transport/activeDutyTracking'

const Dashboard = () => {
    const { email, name } = useAuth()
    const [ctx, setCtx] = useState(() => resolveDriverProfile(email))
    const [dutiesToday, setDutiesToday] = useState(0)
    const [activeDuty, setActiveDuty] = useState(null)

    useEffect(() => {
        Promise.all([
            hydrateDriverProfileSources(),
            hydrateMyDutiesFromApi(),
        ]).finally(() => {
            const next = resolveDriverProfile(email)
            setCtx(next)
            const mine = getMyDuties().filter((duty) => isDutyDateToday(duty.dutyDate || duty.date))
            setDutiesToday(mine.length)
            setActiveDuty(mine.find((duty) => isDutyTrackingActive(duty)) || mine[0] || null)
        })
    }, [email])

    const cards = [
        { label: 'Vehicle', value: ctx.vehicleNumber, to: '/driver/vehicle-management/vehicle-details', icon: Bus },
        { label: 'Route', value: ctx.routeName, to: '/driver/my-route/route-details', icon: Route },
        { label: 'Students on route', value: String(ctx.students.length), to: '/driver/attendance-management/student-attendance', icon: MapPin },
        { label: 'Duties today', value: String(dutiesToday), to: '/driver/my-duty', icon: ClipboardList },
    ]

    return (
        <section className='space-y-6'>
            <div className='bg-white rounded-2xl shadow-md p-4 md:p-6'>
                <h1 className='text-2xl font-semibold text-[#0C1E5B]'>
                    Welcome{name ? `, ${name}` : ''}
                </h1>
                <p className='text-sm text-[#667085] mt-1'>
                    {activeDuty
                        ? `Today’s duty: ${activeDuty.dutyType || activeDuty.shift || 'Trip'} · ${activeDuty.dutyStatus || activeDuty.status || 'Assigned'} on ${activeDuty.routeName || ctx.routeName}`
                        : 'No active duty for today yet. Check My Duty when Transport Manager assigns one.'}
                </p>
                <div className='mt-4 flex flex-wrap gap-3'>
                    <NavLink
                        to='/driver/my-duty'
                        className='inline-flex items-center gap-2 bg-[#515DEF] text-white text-sm px-4 py-2 rounded-md'
                    >
                        <ClipboardList size={16} /> My Duty
                    </NavLink>
                    <NavLink
                        to='/driver/fuel-request/add'
                        className='inline-flex items-center gap-2 border border-[#515DEF] text-[#515DEF] text-sm px-4 py-2 rounded-md'
                    >
                        <Fuel size={16} /> Fuel Request
                    </NavLink>
                    <NavLink
                        to='/driver/maintenance-request/add'
                        className='inline-flex items-center gap-2 border border-[#515DEF] text-[#515DEF] text-sm px-4 py-2 rounded-md'
                    >
                        <Wrench size={16} /> Maintenance Request
                    </NavLink>
                </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4'>
                {cards.map((card) => {
                    const Icon = card.icon
                    return (
                        <NavLink
                            key={card.label}
                            to={card.to}
                            className='bg-white rounded-2xl shadow-md border border-[#EDEEF5] p-4 hover:border-[#515DEF66] transition-colors'
                        >
                            <div className='flex items-center justify-between gap-3'>
                                <p className='text-xs uppercase tracking-wide text-[#667085]'>{card.label}</p>
                                <Icon size={18} className='text-[#515DEF]' />
                            </div>
                            <p className='text-lg font-semibold text-[#0C1E5B] mt-2 truncate'>{card.value || '—'}</p>
                        </NavLink>
                    )
                })}
            </div>
        </section>
    )
}

export default Dashboard
