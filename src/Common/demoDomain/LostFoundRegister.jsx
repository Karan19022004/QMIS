import React from 'react'
import { SimpleRegister } from './DemoScreens'
import { LOST_KEY, LOST_SEED } from './housekeeping'

/** Shared Lost & Found register (same storage/API collection for all entitled ops roles). */
const LostFoundRegister = () => (
    <SimpleRegister
        title="Lost & Found"
        storageKey={LOST_KEY}
        seed={LOST_SEED}
        idPrefix="LF-2026-"
        columns={[
            { key: 'date', label: 'Date' },
            { key: 'item', label: 'Item' },
            { key: 'foundLocation', label: 'Found Location' },
            { key: 'claimStatus', label: 'Claim Status' },
        ]}
        fields={[
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'item', label: 'Item', required: true },
            { key: 'foundLocation', label: 'Found Location' },
            { key: 'reportedBy', label: 'Reported By' },
            { key: 'description', label: 'Description', type: 'textarea' },
            { key: 'claimStatus', label: 'Claim Status', type: 'select', options: ['Unclaimed', 'Claimed'] },
            { key: 'claimedBy', label: 'Claimed By' },
            { key: 'claimedDate', label: 'Claimed Date', type: 'date' },
            { key: 'remarks', label: 'Remarks' },
        ]}
    />
)

export default LostFoundRegister
