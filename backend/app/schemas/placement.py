from uuid import UUID

from pydantic import BaseModel, Field


class PlaceStudentIn(BaseModel):
    section_id: UUID = Field(alias="sectionId")

    model_config = {"populate_by_name": True}


class PromoteStudentIn(BaseModel):
    target_class_id: UUID = Field(alias="targetClassId")
    target_section_id: UUID = Field(alias="targetSectionId")
    academic_year_id: UUID | None = Field(default=None, alias="academicYearId")

    model_config = {"populate_by_name": True}


class CoordinatorGradeBandIn(BaseModel):
    user_id: UUID = Field(alias="userId")
    grade_from: int = Field(alias="gradeFrom", ge=1, le=12)
    grade_to: int = Field(alias="gradeTo", ge=1, le=12)

    model_config = {"populate_by_name": True}
