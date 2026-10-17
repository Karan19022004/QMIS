import React, { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import NotificationsListView from './NotificationsListView'
import {
    canUseNotificationsApi,
    listNotificationsApi,
    markNotificationReadApi,
} from '../../services/notificationsApi'

const DEFAULT_TYPES = ['General', 'Exam', 'Event', 'Holiday', 'Announcement', 'Payment', 'Duty', 'Ops']

const DEFAULT_BADGE = {
    General: 'bg-[#515DEF33] text-[#515DEF]',
    Exam: 'bg-[#9C27B033] text-[#9C27B0]',
    Event: 'bg-[#FF980033] text-[#FF9800]',
    Holiday: 'bg-[#4CAF5033] text-[#4CAF50]',
    Announcement: 'bg-[#2196F333] text-[#2196F3]',
    Payment: 'bg-[#FF572233] text-[#FF5722]',
    Duty: 'bg-[#66708533] text-[#667085]',
    Ops: 'bg-[#515DEF33] text-[#515DEF]',
}

const mapServerNotification = (row) => ({
    id: row.id,
    type: row.entityType || row.type || 'General',
    title: row.title || 'Notification',
    message: row.body || row.message || '',
    relatedDate: row.relatedDate || '',
    notificationDate: row.createdAt
        ? new Date(row.createdAt).toLocaleDateString('en-GB').replace(/\//g, '-')
        : row.notificationDate || '',
    postedBy: row.actorName || row.postedBy || 'System',
    isRead: Boolean(row.isRead),
})

const messageFor = (error) =>
    error?.status === 403
        ? 'You do not have permission to view notifications.'
        : error?.message || 'Notifications could not be loaded.'

/**
 * Campus notifications SoT for staff/ops roles.
 * @param {{ fallback?: array, notificationTypes?: string[], typeBadgeColor?: object, title?: string }} props
 */
export default function StaffNotificationsPage({
    fallback = [],
    notificationTypes = DEFAULT_TYPES,
    typeBadgeColor = DEFAULT_BADGE,
    title = 'Notifications',
}) {
    const location = useLocation()
    const api = canUseNotificationsApi()
    const requestKey = api ? location.key : ''
    const [answer, setAnswer] = useState({ key: '', items: [], error: '' })

    useEffect(() => {
        if (!api) return undefined
        let active = true
        listNotificationsApi()
            .then((rows) => {
                if (active) setAnswer({ key: requestKey, items: (rows || []).map(mapServerNotification), error: '' })
            })
            .catch((error) => {
                if (active) setAnswer({ key: requestKey, items: [], error: messageFor(error) })
            })
        return () => {
            active = false
        }
    }, [api, requestKey])

    if (!api) {
        return (
            <NotificationsListView
                notifications={fallback}
                notificationTypes={notificationTypes}
                typeBadgeColor={typeBadgeColor}
                title={title}
            />
        )
    }

    if (answer.key !== requestKey) return <p className="text-[#667085]">Loading notifications…</p>
    if (answer.error) return <p className="text-[#B42318]">{answer.error}</p>

    const handleOpen = (record) => {
        if (record.isRead) return
        setAnswer((current) => ({
            ...current,
            items: current.items.map((item) => (item.id === record.id ? { ...item, isRead: true } : item)),
        }))
        markNotificationReadApi(record.id).catch(() => {
            setAnswer((current) => ({
                ...current,
                items: current.items.map((item) => (item.id === record.id ? { ...item, isRead: false } : item)),
            }))
        })
    }

    return (
        <NotificationsListView
            notifications={answer.items}
            notificationTypes={notificationTypes}
            typeBadgeColor={typeBadgeColor}
            title={title}
            onOpen={handleOpen}
        />
    )
}
