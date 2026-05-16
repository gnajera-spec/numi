from typing import Optional
from pydantic import BaseModel, field_validator


class SmtpConfigIn(BaseModel):
    host: str = ""
    port: int = 587
    username: str = ""
    password: str = ""
    from_email: str = ""
    from_name: str = "NUMI"
    use_tls: bool = True
    activo: bool = True
    use_numi_smtp: bool = True

    @field_validator("from_email")
    @classmethod
    def validate_email_when_custom(cls, v: str, info) -> str:
        # Solo validar email cuando es SMTP personalizado
        data = info.data
        use_numi = data.get("use_numi_smtp", True)
        if not use_numi and v and "@" not in v:
            raise ValueError("Email inválido")
        return v


class SmtpConfigOut(BaseModel):
    host: str
    port: int
    username: str
    from_email: str
    from_name: str
    use_tls: bool
    activo: bool
    use_numi_smtp: bool = True

    model_config = {"from_attributes": True}


class SmtpTestResult(BaseModel):
    ok: bool
    message: str
