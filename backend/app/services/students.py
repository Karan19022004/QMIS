"""Campus student list & detail (P1-5 UIS)."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Admission, Guardian, Student, User
from app.services.errors import fail


def _iso(value) -> str | None:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _admission_for(db: Session, student: Student) -> Admission | None:
    if student.admission_id:
        row = db.get(Admission, student.admission_id)
        if row is not None:
            return row
    return db.scalar(
        select(Admission).where(Admission.enrolled_student_id == student.id).limit(1)
    )


def _list_item(student: Student, admission: Admission | None) -> dict:
    return {
        "id": str(student.id),
        "name": student.full_name,
        "admissionNumber": student.admission_number,
        "className": student.class_name or "",
        "admissionId": str(student.admission_id) if student.admission_id else None,
        "parentUserId": str(student.parent_user_id) if student.parent_user_id else None,
        "gender": (admission.gender if admission else None) or "",
        "email": (admission.email if admission else None) or "",
        "mobileNumber": (admission.mobile_number if admission else None) or "",
        "dateOfBirth": _iso(admission.date_of_birth) if admission else None,
        "country": (admission.country if admission else None) or "",
        "state": (admission.state if admission else None) or "",
        "city": (admission.city if admission else None) or "",
        "status": (admission.status if admission else None) or "Active",
        "createdAt": _iso(student.created_at),
    }


def list_students(db: Session, actor: User, class_name: str | None = None) -> list[dict]:
    stmt = select(Student).where(Student.campus_id == actor.campus_id)
    if class_name:
        stmt = stmt.where(Student.class_name == class_name)
    stmt = stmt.order_by(Student.full_name)
    rows = db.scalars(stmt).all()
    return [_list_item(row, _admission_for(db, row)) for row in rows]


def get_student(db: Session, actor: User, student_id: UUID) -> dict:
    student = db.get(Student, student_id)
    if student is None or student.campus_id != actor.campus_id:
        fail(404, "not_found", "Student not found.")

    admission = _admission_for(db, student)
    guardians = db.scalars(
        select(Guardian).where(Guardian.student_id == student.id).order_by(Guardian.created_at)
    ).all()

    base = _list_item(student, admission)
    base["guardians"] = [
        {
            "id": str(g.id),
            "fullName": g.full_name,
            "phone": g.phone,
            "relationship": g.relationship,
        }
        for g in guardians
    ]

    if admission is None:
        base["firstName"] = student.full_name
        base["middleName"] = ""
        base["lastName"] = ""
        return base

    base.update(
        {
            "firstName": admission.first_name or "",
            "middleName": admission.middle_name or "",
            "lastName": admission.last_name or "",
            "admissionDate": _iso(admission.admission_date),
            "registrationFees": admission.registration_fees or "",
            "batchStartYear": admission.batch_start_year,
            "batchEndYear": admission.batch_end_year,
            "feesGroup": admission.fees_group or "",
            "religion": admission.religion or "",
            "caste": admission.caste or "",
            "address": admission.address or "",
            "zipCode": admission.zip_code or "",
            "altMobileNumber": admission.alt_mobile_number or "",
            "previousSchool": admission.previous_school or "",
            "bloodGroup": admission.blood_group or "",
            "height": admission.height or "",
            "weight": admission.weight or "",
            "medicalHistory": admission.medical_history or "",
            "profileImageFileId": str(admission.profile_image_file_id)
            if admission.profile_image_file_id
            else None,
            "modeOfTransport": admission.mode_of_transport or "",
            "route": admission.route or "",
            "busStop": admission.bus_stop or "",
            "fatherName": admission.father_name or "",
            "motherName": admission.mother_name or "",
            "fatherOccupation": admission.father_occupation or "",
            "motherOccupation": admission.mother_occupation or "",
            "fatherIncome": admission.father_income or "",
            "motherIncome": admission.mother_income or "",
            "siblings": admission.siblings or "",
            "parentAddress": admission.parent_address or "",
            "parentCountry": admission.parent_country or "",
            "parentState": admission.parent_state or "",
            "parentCity": admission.parent_city or "",
            "parentZipCode": admission.parent_zip_code or "",
            "parentMobileNumber": admission.parent_mobile_number or "",
            "parentAltMobileNumber": admission.parent_alt_mobile_number or "",
            "parentEmail": admission.parent_email or "",
            "parentAccountEmail": admission.parent_account_email or "",
        }
    )
    return base
