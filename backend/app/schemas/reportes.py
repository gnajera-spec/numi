from pydantic import BaseModel


class DashboardKPIs(BaseModel):
    headcount: int
    licencias_activas_hoy: int
    licencias_pendientes_aprobacion: int
    vencimientos_proximos_30d: int
    recibos_sin_firmar: int
    comunicados_sin_confirmar: int


class SedeCount(BaseModel):
    sede: str
    count: int


class DepartamentoCount(BaseModel):
    departamento: str
    count: int


class HeadcountDistribucion(BaseModel):
    total: int
    por_sede: list[SedeCount]
    por_departamento: list[DepartamentoCount]


class TendenciaMes(BaseModel):
    mes: str
    total: int
    aprobadas: int
    rechazadas: int
    pendientes: int


class TendenciaLicencias(BaseModel):
    tendencia: list[TendenciaMes]
