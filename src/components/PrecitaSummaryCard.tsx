import { useState, useEffect } from 'react';
import { getLatestPrecitaForPatient, getPrecitaForSlot, type PrecitaRecord } from '../api/precita';
import { useTheme } from '../context/ThemeContext';
import { SectionHeader } from './SectionHeader';

interface Props { patientId: string; brand: string; agendaSlotId?: string; }

const FIELD_LABELS: Record<string, string> = {
  chief_complaint:    'Motivo principal',
  symptoms:           'Síntomas',
  symptom_started_at: 'Desde',
  severity:           'Intensidad',
  current_medications:'Medicamentos actuales',
  allergies:          'Alergias',
  relevant_history:   'Antecedentes',
  additional_notes:   'Notas adicionales',
};

const DISPLAY_ORDER = [
  'chief_complaint',
  'symptoms',
  'symptom_started_at',
  'severity',
  'current_medications',
  'allergies',
  'relevant_history',
  'additional_notes',
];

export function PrecitaSummaryCard({ patientId, brand, agendaSlotId }: Props) {
  const { tokens } = useTheme();
  const [record, setRecord] = useState<PrecitaRecord | null | undefined>(undefined);
  const isFallback = !agendaSlotId;

  useEffect(() => {
    setRecord(undefined);
    const fetch = agendaSlotId
      ? getPrecitaForSlot(agendaSlotId)
      : getLatestPrecitaForPatient(patientId);
    fetch.then(setRecord).catch(() => setRecord(null));
  }, [patientId, agendaSlotId]);

  if (record === undefined || record === null) return null;

  const submittedDate = new Date(record.submittedAt).toLocaleDateString('es-MX', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <>
      <SectionHeader title="Pre-cita del paciente" />
      <div style={{
        background: tokens.surface, border: `1px solid ${brand}40`,
        borderRadius: 12, overflow: 'hidden', marginBottom: 4,
      }}>
        <div style={{
          padding: '8px 14px', background: brand + '10',
          borderBottom: `1px solid ${brand}20`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 11.5, fontFamily: 'Franklin Gothic', fontWeight: 500, color: brand }}>
              Cuestionario enviado por el paciente
            </span>
            {isFallback && (
              <span style={{ fontSize: 10.5, color: tokens.textSecondary, fontStyle: 'italic' }}>
                Última pre-cita enviada
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: tokens.textSecondary }}>
            {submittedDate}
          </span>
        </div>

        {DISPLAY_ORDER.map((key, i, arr) => {
          const val = (record.payload as any)[key];
          if (!val || String(val).trim() === '') return null;
          return (
            <div key={key} style={{
              display: 'grid', gridTemplateColumns: '160px 1fr', gap: 10,
              padding: '10px 14px',
              borderBottom: i < arr.length - 1 ? `1px solid ${tokens.borderLight}` : 'none',
              fontSize: 13, color: tokens.text,
            }}>
              <div style={{ fontSize: 11, color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 1 }}>
                {FIELD_LABELS[key] ?? key}
              </div>
              <div style={{ lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{String(val)}</div>
            </div>
          );
        })}
      </div>
    </>
  );
}
