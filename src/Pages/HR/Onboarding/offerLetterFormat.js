import { PORTAL_LOGO, PORTAL_LOGO_ALT } from '../../../constants/portalLogo'
import { SCHOOL_PROFILE } from '../../../constants/schoolProfile'
import { formatInr } from '../domain/payrollCalculations'

const cell = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const logoSrc = () => {
    try {
        return new URL(PORTAL_LOGO, window.location.href).href
    } catch {
        return PORTAL_LOGO
    }
}

/**
 * Full branded Offer / Appointment letter HTML (body only — wrapped by printHtml).
 */
export function buildOfferLetterHtml(record, candidate = {}) {
    const kind = record?.kind === 'Appointment' ? 'Appointment' : 'Offer'
    const title = kind === 'Appointment' ? 'APPOINTMENT LETTER' : 'OFFER OF EMPLOYMENT'
    const name = candidate?.name || 'Candidate'
    const address = candidate?.address || '—'
    const email = candidate?.email || '—'
    const mobile = candidate?.mobile || '—'
    const position = record?.position || candidate?.position || '—'
    const designation = record?.designation || position
    const department = record?.department || '—'
    const joining = record?.joiningDate || '—'
    const offerDate = record?.offerDate || '—'
    const validity = record?.validityDate || '—'
    const probation = record?.probation || '6 months'
    const employmentType = record?.employmentType || 'Full Time'
    const manager = record?.reportingManager || '—'
    const terms = record?.terms || 'Confirmation after satisfactory completion of probation.'
    const salary = formatInr(record?.grossSalary)
    const ctc = record?.ctc ? formatInr(record.ctc) : '—'
    const ref = record?.id || '—'

    return `
<style>
  .letter-header { display:flex; gap:16px; align-items:center; border-bottom:3px solid #0C1E5B; padding-bottom:14px; margin-bottom:18px; }
  .letter-header img { width:88px; height:auto; object-fit:contain; }
  .letter-header .meta { flex:1; }
  .letter-header h1 { margin:0; font-size:20px; color:#0C1E5B; font-family:Arial,sans-serif; }
  .letter-header p { margin:3px 0 0; font-size:12px; color:#475467; font-family:Arial,sans-serif; line-height:1.35; }
  .letter-title { text-align:center; margin:22px 0 8px; font-size:18px; letter-spacing:.06em; color:#0C1E5B; font-family:Arial,sans-serif; }
  .letter-sub { text-align:center; margin:0 0 22px; font-size:12px; color:#667085; font-family:Arial,sans-serif; }
  .letter-row { display:flex; justify-content:space-between; gap:16px; font-size:13px; margin-bottom:16px; font-family:Arial,sans-serif; }
  .letter-body { font-size:14px; line-height:1.55; }
  .letter-body p { margin:0 0 12px; }
  .letter-table { width:100%; border-collapse:collapse; margin:16px 0 18px; font-family:Arial,sans-serif; font-size:13px; }
  .letter-table th, .letter-table td { border:1px solid #D0D5DD; padding:8px 10px; text-align:left; vertical-align:top; }
  .letter-table th { width:34%; background:#F2F4F7; color:#344054; font-weight:600; }
  .sign-grid { display:grid; grid-template-columns:1fr 1fr; gap:28px; margin-top:48px; font-family:Arial,sans-serif; font-size:13px; }
  .sign-box { border-top:1px solid #98A2B3; padding-top:8px; min-height:72px; }
  .letter-footer { margin-top:36px; border-top:1px solid #E4E7EC; padding-top:10px; font-size:11px; color:#667085; font-family:Arial,sans-serif; text-align:center; }
</style>
<div class="letter-header">
  <img src="${cell(logoSrc())}" alt="${cell(PORTAL_LOGO_ALT)}" />
  <div class="meta">
    <h1>${cell(SCHOOL_PROFILE.name)}</h1>
    <p>${cell(SCHOOL_PROFILE.affiliation)}</p>
    <p>${cell(SCHOOL_PROFILE.addressLine)}</p>
    <p>${cell(SCHOOL_PROFILE.contactLine)}</p>
  </div>
</div>

<h2 class="letter-title">${cell(title)}</h2>
<p class="letter-sub">Ref. No. ${cell(ref)} · Status: ${cell(record?.status || 'Draft')}</p>

<div class="letter-row">
  <div>
    <strong>To,</strong><br/>
    ${cell(name)}<br/>
    ${cell(address)}<br/>
    ${cell(mobile)} · ${cell(email)}
  </div>
  <div style="text-align:right">
    <div>Date: <strong>${cell(offerDate)}</strong></div>
    ${validity !== '—' ? `<div>Valid until: <strong>${cell(validity)}</strong></div>` : ''}
  </div>
</div>

<div class="letter-body">
  <p>Dear <strong>${cell(name)}</strong>,</p>
  <p>
    We are pleased to ${kind === 'Appointment' ? 'confirm your appointment' : 'offer you employment'} at
    <strong>${cell(SCHOOL_PROFILE.name)}</strong> on the terms set out below.
  </p>
</div>

<table class="letter-table">
  <tr><th>Position</th><td>${cell(position)}</td></tr>
  <tr><th>Designation</th><td>${cell(designation)}</td></tr>
  <tr><th>Department</th><td>${cell(department)}</td></tr>
  <tr><th>Employment type</th><td>${cell(employmentType)}</td></tr>
  <tr><th>Date of joining</th><td>${cell(joining)}</td></tr>
  <tr><th>Probation</th><td>${cell(probation)}</td></tr>
  <tr><th>Reporting manager</th><td>${cell(manager)}</td></tr>
  <tr><th>Gross salary (monthly)</th><td>${cell(salary)}</td></tr>
  <tr><th>Indicative CTC (annual)</th><td>${cell(ctc)}</td></tr>
</table>

<div class="letter-body">
  <p><strong>Terms &amp; conditions</strong></p>
  <p>${cell(terms)}</p>
  <p>
    This ${kind.toLowerCase()} is contingent on successful completion of joining formalities and submission of
    required documents. Kindly sign and return a copy of this letter to confirm acceptance
    ${validity !== '—' ? `on or before <strong>${cell(validity)}</strong>` : 'by the stated validity date'}.
  </p>
  <p>We look forward to welcoming you to the ${cell(SCHOOL_PROFILE.name)} family.</p>
  <p>Yours sincerely,</p>
</div>

<div class="sign-grid">
  <div class="sign-box">
    <strong>For ${cell(SCHOOL_PROFILE.name)}</strong><br/>
    Authorised Signatory · HR
  </div>
  <div class="sign-box">
    <strong>Candidate acceptance</strong><br/>
    Signature / Date
  </div>
</div>

<p class="letter-footer">
  ${cell(SCHOOL_PROFILE.name)} · ${cell(SCHOOL_PROFILE.contactLine)}
</p>
`
}
