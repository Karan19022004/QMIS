import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { hydrateAnnouncementFromApi, hydrateAnnouncementsFromApi, usesAnnouncementsApi } from './announcementData'

const messageFor = (error) =>
    error?.status === 403
        ? 'You do not have permission to view announcements.'
        : error?.message || 'Announcements could not be loaded.'

/**
 * `status` is 'loading' | 'error' | 'ready' for something fetched from the server every time the screen
 * opens (state is only set once the request answers). Without a backend session it is always 'ready' and
 * the browser-only list is read as before.
 */
function useServerRead(roleKey, name, load) {
    const location = useLocation()
    const api = usesAnnouncementsApi(roleKey)
    const requestKey = api ? `${name}:${location.key}` : ''
    const [answer, setAnswer] = useState({ key: '', error: '', notFound: false })

    useEffect(() => {
        if (!api) return undefined
        let active = true
        load()
            .then(() => {
                if (active) setAnswer({ key: requestKey, error: '', notFound: false })
            })
            .catch((error) => {
                if (active) setAnswer({ key: requestKey, error: messageFor(error), notFound: error?.status === 404 })
            })
        return () => {
            active = false
        }
    }, [api, requestKey, load])

    const status = !api ? 'ready' : answer.key !== requestKey ? 'loading' : answer.error ? 'error' : 'ready'
    return { status, error: answer.error, notFound: answer.notFound && answer.key === requestKey }
}

/** The announcements this person may see. */
export const useAnnouncementList = (roleKey) => useServerRead(roleKey, 'list', hydrateAnnouncementsFromApi)

/** One announcement, with this person's acknowledgement and replies. */
export const useAnnouncementDetail = (roleKey, id) => {
    const load = useCallback(() => hydrateAnnouncementFromApi(id), [id])
    return useServerRead(roleKey, `one:${id}`, load)
}
