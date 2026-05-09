# REQ_09 — Módulo de Servicio Médico

**Estado:** ⏳ Pendiente  
**Módulo:** servicio_medico  
**Prioridad:** Media  
**Referencia AF:** Sección 4.6  
**Actor principal:** Perfil Servicio Médico

---

## Descripción

Herramientas para que los profesionales del área médica gestionen la salud laboral de los colaboradores: fichas médico-laborales, aptitudes, certificados, licencias por enfermedad y accidentes de trabajo. Los datos médicos están protegidos con acceso restringido (solo Servicio Médico y el propio colaborador).

---

## Requerimientos funcionales

### 4.6.1 — Ficha Médico-Laboral del Colaborador

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-09-01 | Registrar grupo sanguíneo, alergias y condiciones preexistentes relevantes para el trabajo | ⏳ |
| RF-09-02 | Historial de exámenes médicos: preocupacional, periódico, post-ausencia | ⏳ |
| RF-09-03 | Registro de vacunaciones requeridas por el puesto | ⏳ |
| RF-09-04 | Historial de accidentes laborales y enfermedades profesionales | ⏳ |
| RF-09-05 | Documentos adjuntos: estudios, certificados, informes médicos | ⏳ |

### 4.6.2 — Gestión de Aptitudes Laborales

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-09-06 | Emitir certificado de aptitud: APTO / APTO CON RESTRICCIONES / NO APTO | ⏳ |
| RF-09-07 | Configurar fecha de vencimiento del certificado por puesto | ⏳ |
| RF-09-08 | Alertas automáticas de vencimiento próximo a los 30, 15 y 5 días | ⏳ |
| RF-09-09 | Historial de certificados emitidos por colaborador | ⏳ |

### 4.6.3 — Control de Licencias por Enfermedad

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-09-10 | Validar y registrar certificados médicos adjuntos en solicitudes de licencia por enfermedad | ⏳ |
| RF-09-11 | Seguimiento de días de enfermedad acumulados en el período con alertas por proximidad al límite legal | ⏳ |
| RF-09-12 | El bot puede solicitar al colaborador adjuntar certificado médico vía WhatsApp | ⏳ |
| RF-09-13 | Registro de controles médicos domiciliarios: fecha, hora, resultado | ⏳ |

### 4.6.4 — Registro de Accidentes de Trabajo

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-09-14 | Alta de denuncia de accidente: fecha, hora, lugar, descripción, testigos | ⏳ |
| RF-09-15 | Seguimiento de estado del siniestro: Abierto / En tratamiento / Alta médica / Cerrado | ⏳ |
| RF-09-16 | Registro del número de siniestro ART | ⏳ |
| RF-09-17 | Reportes de accidentología por período, sector y tipo de siniestro | ⏳ |

### 4.6.5 — Reportes de Servicio Médico

| ID | Descripción | Estado |
|----|-------------|--------|
| RF-09-18 | Reporte de ausentismo médico: días perdidos por departamento y período | ⏳ |
| RF-09-19 | Reporte de vencimientos de aptitud: colaboradores con aptitud próxima a vencer o vencida | ⏳ |
| RF-09-20 | Reporte de accidentología por período, tipo y sector | ⏳ |
| RF-09-21 | Reporte de enfermedades crónicas/recurrentes (anonimizado para privacidad) | ⏳ |
| RF-09-22 | Reporte de cumplimiento de exámenes periódicos pendientes | ⏳ |

---

## Reportes disponibles

| Reporte | Descripción |
|---------|-------------|
| Ausentismo médico | Días perdidos por enfermedad por departamento y período |
| Vencimientos de aptitud | Colaboradores con aptitud próxima a vencer o vencida |
| Accidentología | Siniestros por período, tipo y sector |
| Enfermedades crónicas/recurrentes | Ausentismo frecuente (anonimizado) |
| Cumplimiento de exámenes | Colaboradores con exámenes periódicos pendientes |

---

## Marco normativo

- **Resolución SRT** — Seguridad e Higiene en el Trabajo: aptitudes y accidentes.
- **Ley 24.557** — Ley de Riesgos del Trabajo: siniestros y ART.
- **Ley 25.326** — Protección de Datos Personales: datos médicos sensibles.

---

## Tablas involucradas

Ver `docs/DATA_MODEL.md` → Tablas `fichas_medicas`, `aptitudes_laborales`, `accidentes_trabajo`, `examenes_medicos`, `vacunaciones`.

---

## Endpoints involucrados

Ver `docs/API_SPEC.md` → Sección Servicio Médico.

---

## Notas de implementación

- Los datos médicos deben estar cifrados en reposo (AES-256) y con RLS diferenciado en Supabase.
- Los reportes de enfermedades recurrentes deben anonimizar los datos identificatorios del colaborador.
- La solicitud de certificado vía WhatsApp debe integrarse con el flujo de licencias (REQ_08): al aprobar una licencia ENF, el bot dispara automáticamente la solicitud de certificado.
- Los documentos médicos tienen URL firmadas con expiración más corta (6 hs) que los recibos por su sensibilidad.
