/**
 * Client-side table export helpers used by ExportModal / HrExport.
 * CSV is the native format; Excel uses UTF-8 BOM CSV (opens cleanly in Excel);
 * PDF opens a print-friendly HTML table (no extra dependency).
 */

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

const normalizeRows = (rows, columns) => {
    const list = Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : []
    if (!list.length) return { headers: [], body: [] }
    const headers = Array.isArray(columns) && columns.length
        ? columns.map((col) => (typeof col === 'string' ? col : col.key))
        : Object.keys(list[0])
    const labels = Array.isArray(columns) && columns.length
        ? columns.map((col) => (typeof col === 'string' ? col : col.label || col.key))
        : headers
    const body = list.map((row) =>
        headers.map((key) => {
            const raw = row[key]
            if (raw == null) return ''
            if (typeof raw === 'object') return JSON.stringify(raw)
            return String(raw)
        }),
    )
    return { headers: labels, body }
}

const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
}

export const downloadTableCsv = (filename, rows, columns) => {
    const { headers, body } = normalizeRows(rows, columns)
    if (!headers.length) return false
    const lines = [
        headers.map(escapeCsv).join(','),
        ...body.map((cells) => cells.map(escapeCsv).join(',')),
    ]
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' })
    const base = String(filename || 'export').replace(/\.(csv|xlsx|xls|pdf)$/i, '')
    triggerDownload(blob, `${base}.csv`)
    return true
}

/** Excel-compatible UTF-8 CSV (no XLSX dependency). */
export const downloadTableExcel = (filename, rows, columns) => {
    const { headers, body } = normalizeRows(rows, columns)
    if (!headers.length) return false
    const lines = [
        headers.map(escapeCsv).join(','),
        ...body.map((cells) => cells.map(escapeCsv).join(',')),
    ]
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], {
        type: 'application/vnd.ms-excel;charset=utf-8;',
    })
    const base = String(filename || 'export').replace(/\.(csv|xlsx|xls|pdf)$/i, '')
    triggerDownload(blob, `${base}.xls`)
    return true
}

export const openTablePdf = (title, rows, columns) => {
    const { headers, body } = normalizeRows(rows, columns)
    if (!headers.length) return false
    const head = headers.map((h) => `<th>${String(h).replace(/</g, '&lt;')}</th>`).join('')
    const trs = body
        .map(
            (cells) =>
                `<tr>${cells.map((c) => `<td>${String(c).replace(/</g, '&lt;')}</td>`).join('')}</tr>`,
        )
        .join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${String(title || 'Export').replace(/</g, '&lt;')}</title>
<style>body{font-family:Arial,sans-serif;padding:24px;color:#1e1e1e}h1{font-size:18px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #e5e7eb;padding:8px;text-align:left;font-size:12px}th{background:#f5f5f5}</style>
</head><body><h1>${String(title || 'Export').replace(/</g, '&lt;')}</h1><table><thead><tr>${head}</tr></thead><tbody>${trs}</tbody></table></body></html>`
    const frame = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720')
    if (!frame) return false
    frame.document.write(html)
    frame.document.close()
    frame.focus()
    frame.print()
    return true
}

export const runTableExport = (format, { filename = 'export', rows = [], columns, title } = {}) => {
    if (!Array.isArray(rows) || rows.length === 0) return { ok: false, reason: 'empty' }
    if (format === 'pdf') {
        return { ok: openTablePdf(title || filename, rows, columns), reason: 'pdf' }
    }
    if (format === 'excel') {
        return { ok: downloadTableExcel(filename, rows, columns), reason: 'excel' }
    }
    return { ok: downloadTableCsv(filename, rows, columns), reason: 'csv' }
}
