from pydantic import BaseModel, Field


class HarassmentType(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    text: str = Field(min_length=1, max_length=500)


class CommitteeMember(BaseModel):
    role: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=150)
    detail: str = Field(min_length=1, max_length=250)


class PolicyFaq(BaseModel):
    question: str = Field(min_length=1, max_length=250)
    answer: str = Field(min_length=1, max_length=1000)


class PoshPolicyPayload(BaseModel):
    title: str = Field(min_length=3, max_length=200)
    overview: str = Field(min_length=10, max_length=4000)
    version: str = Field(min_length=1, max_length=50)
    approved_date: str = Field(min_length=1, max_length=50)
    harassment_types: list[HarassmentType]
    committee_members: list[CommitteeMember]
    rights: list[str] = Field(min_length=1)
    faqs: list[PolicyFaq]


class PoshPolicyResponse(PoshPolicyPayload):
    policy_id: int | None = None
    company_id: int | None = None
    document_path: str | None = None
    document_name: str | None = None
