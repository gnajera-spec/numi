import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminLayout } from "../../components/AdminLayout";
import { adminLicenciasService } from "../../services/adminLicenciasService";
import type { CalendarioItem } from "../../services/adminLicenciasService";
import { organizacionService } from "../../services/organizacionService";
import type { Departamento } from "../../types";

/* ── helpers ─────────────────────────────────────────────────────────────── */
const DIAS_SEMANA = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function padTwo(n: number): string {
  return String(n).padStart(2, "0");
}

function mesString(year: number, month: number): string {
  return `${year}-${padTwo(month)}`;
}

function dayString(year: number, month: number, day: number): string {
  return `${year}-${padTwo(month)}-${padTwo(day)}`;
}

function getAbsenciasForDay(day: number, year: number, month: number, items: CalendarioItem[]): CalendarioItem[] {
  const dateStr = dayString(year, month, day);
  return items.filter(item => item.fecha_inicio <= dateStr && item.fecha_fin >= dateStr);
}

function shortNombre(nombre: string): string {
  const parts = nombre.trim().split(" ");
  if (parts.length < 2) return nombre;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function estadoColor(estado: string): { bg: string; text: string } {
  switch (estado) {
    case "aprobada":
      return { bg: "var(--color-success-light, #dcfce7)", text: "var(--color-success, #16a34a)" };
    case "en_revision":
      return { bg: "#ede9fe", text: "#7c3aed" };
    case "pendiente":
    default:
      return { bg: "#fef3c7", text: "#d97706" };
  }
}

/* ── page ─────────────────────────────────────────────────────────────────── */
export function AdminCalendarioPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-indexed

  const [items, setItems] = useState<CalendarioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("");

  /* fetch departamentos once */
  useEffect(() => {
    organizacionService.listDepartamentos({ is_active: true })
      .then(data => setDepartamentos(data))
      .catch(() => {/* non-critical */ });
  }, []);

  /* fetch calendar data */
  useEffect(() => {
    setLoading(true);
    setError(null);
    adminLicenciasService
      .getCalendario(mesString(year, month), selectedDept || undefined)
      .then(data => {
        setItems(data);
        setLoading(false);
      })
      .catch(err => {
        setError((err as Error).message ?? "Error al cargar el calendario");
        setLoading(false);
      });
  }, [year, month, selectedDept]);

  /* navigation */
  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  /* calendar grid */
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday = 0

  // Build weeks: array of 7-element arrays (null = empty cell)
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  // Pad to complete last week
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  const isToday = (day: number | null) => {
    if (!day) return false;
    const t = new Date();
    return t.getFullYear() === year && t.getMonth() + 1 === month && t.getDate() === day;
  };

  return (
    <AdminLayout>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          marginBottom: 20, flexWrap: "wrap",
        }}>
          <h1 style={{
            margin: 0, fontSize: 20, fontWeight: 700,
            color: "var(--color-text-primary)", flex: 1,
          }}>
            Calendario de Ausencias
          </h1>

          {/* Department filter */}
          <select
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
            style={{
              padding: "7px 12px", borderRadius: 8, fontSize: 13,
              border: "1px solid var(--color-border)",
              background: "var(--color-bg-card)",
              color: "var(--color-text-primary)",
              cursor: "pointer",
            }}
          >
            <option value="">Todos los departamentos</option>
            {departamentos.map(d => (
              <option key={d.id} value={d.id}>{d.nombre}</option>
            ))}
          </select>

          {/* Month navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              onClick={prevMonth}
              aria-label="Mes anterior"
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-card)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--color-text-secondary)",
              }}
            >
              <ChevronLeft size={16} />
            </button>

            <span style={{
              fontSize: 15, fontWeight: 600,
              color: "var(--color-text-primary)",
              minWidth: 130, textAlign: "center",
            }}>
              {MESES[month - 1]} {year}
            </span>

            <button
              onClick={nextMonth}
              aria-label="Mes siguiente"
              style={{
                width: 32, height: 32, borderRadius: 8,
                border: "1px solid var(--color-border)",
                background: "var(--color-bg-card)",
                cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "var(--color-text-secondary)",
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
          {(["aprobada", "en_revision", "pendiente"] as const).map(estado => {
            const { bg, text } = estadoColor(estado);
            const label = estado === "aprobada" ? "Aprobada" : estado === "en_revision" ? "En revisión" : "Pendiente";
            return (
              <div key={estado} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
                <span style={{
                  display: "inline-block", width: 10, height: 10,
                  borderRadius: 3, background: bg, border: `1px solid ${text}`,
                }} />
                <span style={{ color: "var(--color-text-secondary)" }}>{label}</span>
              </div>
            );
          })}
        </div>

        {/* States */}
        {loading && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--color-text-secondary)" }}>
            Cargando calendario...
          </div>
        )}
        {error && !loading && (
          <div style={{
            padding: "16px 20px", borderRadius: 10,
            background: "#fff5f5", border: "1px solid #fc8181",
            color: "#c53030", fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {/* Calendar grid */}
        {!loading && !error && (
          <div style={{
            background: "var(--color-bg-card)",
            border: "1px solid var(--color-border)",
            borderRadius: 12,
            overflow: "hidden",
          }}>
            {/* Day-of-week header */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
              borderBottom: "1px solid var(--color-border)",
            }}>
              {DIAS_SEMANA.map(d => (
                <div key={d} style={{
                  padding: "8px 0",
                  textAlign: "center",
                  fontSize: 11, fontWeight: 700,
                  letterSpacing: "0.5px",
                  color: "var(--color-text-secondary)",
                  textTransform: "uppercase",
                }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div
                key={wi}
                style={{
                  display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
                  borderBottom: wi < weeks.length - 1 ? "1px solid var(--color-border)" : "none",
                }}
              >
                {week.map((day, di) => {
                  const absencias = day ? getAbsenciasForDay(day, year, month, items) : [];
                  const today = isToday(day);
                  return (
                    <div
                      key={di}
                      style={{
                        minHeight: 90,
                        padding: "6px 6px 4px",
                        borderLeft: di > 0 ? "1px solid var(--color-border)" : "none",
                        background: day ? "var(--color-bg-card)" : "var(--color-bg-app, #f8f9fa)",
                        position: "relative",
                      }}
                    >
                      {day && (
                        <>
                          {/* Day number */}
                          <div style={{
                            display: "flex", justifyContent: "flex-end",
                            marginBottom: 4,
                          }}>
                            <span style={{
                              fontSize: 12, fontWeight: today ? 700 : 500,
                              color: today ? "#fff" : "var(--color-text-secondary)",
                              background: today ? "var(--color-primary)" : "transparent",
                              width: 22, height: 22,
                              borderRadius: "50%",
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}>
                              {day}
                            </span>
                          </div>

                          {/* Absence chips */}
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, overflow: "hidden" }}>
                            {absencias.slice(0, 4).map(item => {
                              const { bg, text } = estadoColor(item.estado);
                              return (
                                <div
                                  key={item.id}
                                  title={`${item.user_nombre} — ${item.tipo_licencia.nombre} (${item.estado})`}
                                  style={{
                                    background: bg,
                                    color: text,
                                    borderRadius: 4,
                                    padding: "1px 5px",
                                    fontSize: 10,
                                    fontWeight: 600,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    cursor: "default",
                                  }}
                                >
                                  {shortNombre(item.user_nombre)} · {item.tipo_licencia.codigo}
                                </div>
                              );
                            })}
                            {absencias.length > 4 && (
                              <div style={{
                                fontSize: 10, color: "var(--color-text-secondary)",
                                paddingLeft: 4,
                              }}>
                                +{absencias.length - 4} más
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && items.length === 0 && (
          <p style={{
            textAlign: "center", color: "var(--color-text-secondary)",
            fontSize: 14, marginTop: 16,
          }}>
            No hay ausencias registradas para este mes.
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
