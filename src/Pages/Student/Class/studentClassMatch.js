/** Match campus class records to the active student profile. */
export const classKey = (value) => String(value || '').trim().toLowerCase()

export const gradeToken = (value) => {
    const match = String(value || '').match(/(\d{1,2})/)
    return match ? match[1] : ''
}

export const matchesStudentClass = (record, student) => {
    if (!student) return false
    const wantClass = classKey(student.className)
    const wantSection = classKey(student.section)
    if (!wantClass) return false

    const recordClass = classKey(record?.className || record?.classSection)
    const recordSection = classKey(record?.section)
    const wantGrade = gradeToken(wantClass)
    const recordGrade = gradeToken(recordClass)

    const classOk =
        recordClass === wantClass
        || (wantGrade && recordGrade && wantGrade === recordGrade)
        || recordClass.includes(wantClass)
        || wantClass.includes(recordClass)

    if (!classOk) return false
    if (!wantSection || wantSection === '—' || wantSection === '-') return true
    if (!recordSection) return true
    return recordSection === wantSection
}
