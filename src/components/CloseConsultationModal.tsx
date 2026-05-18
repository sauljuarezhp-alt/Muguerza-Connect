import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import { getConsultationTypes, closeConsultationFromSlot, type ConsultationType } from '../api/consultationTypes';
import { CATEGORY_LABEL } from '../data/consultationTemplates';

interface Props {
  slot: {
    id: string;
    tm: string;
    why?: string;
    patient_id: string;
    name: string;
  };
  doctorId: string;
  brand: string;
  onClose: () => void;
  onDone: () => void;
}

const PAYMENT_METHODS = [
  { value: 'efectivo',    label: 'Efectivo' },
  { value: 'tarjeta',     label: 'Tarjeta' },
  { value: 'aseguradora', label: 'Aseguradora' },
  { value: 'cortesia',    label: 'Cortesía' },
] as const;

type PaymentMethod = typeof PAYMENT_METHODS[number]['value'];

export function CloseConsultationModal({ slot, doctorId, brand, onClose, onDone }: Props) {
  const { tokens } = useTheme();
  const [types, setTypes] = useState<ConsultationType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [fee, setFee] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('efectivo');
  const [insurer, setInsurer] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getConsultationTypes(doctorId)
      .then(t => { setTypes(t); setLoadingTypes(false); })
      .catch(() => setLoadingTypes(false));
  }, [doctorId]);

  // Al seleccionar tipo, autollenar fee con base_fee
  function handleSelectType(id: string) {
    setSelectedTypeId(id);
    const t = types.find(x => x.id === id);
    if (t) setFee(String(t.baseFee));
    setError('');
  }

  const selectedType = types.find(t => t.id === selectedTypeId);

  function validateFee(): boolean {
    const val = parseFloat(fee);
    if (isNaN(val) || val < 0) { setError('El monto debe ser un número mayor o igual a 0.'); return false; }
    if (selectedType?.minFee != null && val < selectedType.minFee) {
      setError(`El monto mínimo para este tipo es $${selectedType.minFee}.`); return false;
    }
    if (selectedType?.maxFee != null && val > selectedType.maxFee) {
      setError(`El monto máximo para este tipo es $${selectedType.maxFee}.`); return false;
    }
    return true;
  }

  async function handleSave() {
    if (!selectedTypeId) { setError('Selecciona un tipo de consulta.'); return; }
    if (!validateFee()) return;
    if (paymentMethod === 'aseguradora' && !insurer.trim()) {
      setError('Escribe el nombre de la aseguradora.'); return;
    }
    setSaving(true);
    setError('');
    try {
      await closeConsultationFromSlot(
        {
          doctorId,
          patientId: slot.patient_id,
          agendaSlotId: slot.id,
          consultationTypeId: selectedTypeId,
          fee: parseFloat(fee),
          paymentMethod,
          insurer: paymentMethod === 'aseguradora' ? insurer.trim() : undefined,
        },
        { tm: slot.tm, why: slot.why }
      );
      onDone();
    } catch (e: any) {
      setError(e.message || 'Error al cerrar la consulta.');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 8,
    border: `1px solid ${tokens.border}`, background: tokens.inputBg,
    color: tokens.text, fontSize: 13, fontFamily: 'Franklin Gothic',
    outline: 'none', boxSizing: 'border-box' as const,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: tokens.surface, borderRadius: 14,
        width: 460, maxWidth: '95vw', padding: '22px 24px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 16, color: tokens.text }}>
              Cerrar consulta
            </div>
            <div style={{ fontSize: 12.5, color: tokens.textSecondary, marginTop: 3 }}>
              {slot.name} · {slot.tm}{slot.why ? ` · ${slot.why}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: tokens.textSecondary, fontSize: 20, lineHeight: 1, padding: '0 2px' }}>×</button>
        </div>

        {loadingTypes ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: tokens.textSecondary, fontSize: 13 }}>
            Cargando tipos de consulta...
          </div>
        ) : types.length === 0 ? (
          <div style={{ background: '#E0890018', border: '1px solid #E08900', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
            <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, color: '#E08900', marginBottom: 4 }}>
              Sin tipos de consulta configurados
            </div>
            <div style={{ fontSize: 12, color: tokens.textSecondary, lineHeight: 1.5 }}>
              El doctor debe configurar al menos un tipo de consulta en "Mi práctica → Tipos de consulta" antes de poder cerrar citas con ingresos.
            </div>
          </div>
        ) : (
          <>
            {/* Tipo de consulta */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11.5, color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontWeight: 500, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Tipo de consulta
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {types.map(t => (
                  <div key={t.id}
                    onClick={() => handleSelectType(t.id)}
                    style={{
                      padding: '9px 12px', borderRadius: 9, cursor: 'pointer',
                      border: `1.5px solid ${selectedTypeId === t.id ? brand : tokens.border}`,
                      background: selectedTypeId === t.id ? brand + '10' : tokens.surfaceAlt,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    <div>
                      <span style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, color: tokens.text }}>{t.name}</span>
                      <span style={{ fontSize: 11, color: tokens.textSecondary, marginLeft: 8 }}>
                        {CATEGORY_LABEL[t.category]}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 13, color: selectedTypeId === t.id ? brand : tokens.textSecondary, fontWeight: 500 }}>
                      ${t.baseFee.toLocaleString('es-MX')}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Monto */}
            {selectedTypeId && (
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11.5, color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontWeight: 500, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Monto cobrado (MXN)
                  {selectedType?.minFee != null && selectedType?.maxFee != null && (
                    <span style={{ fontWeight: 400, marginLeft: 6 }}>
                      ${selectedType.minFee.toLocaleString()} – ${selectedType.maxFee.toLocaleString()}
                    </span>
                  )}
                </label>
                <input
                  type="number" min={0} step={50}
                  value={fee}
                  onChange={e => { setFee(e.target.value); setError(''); }}
                  style={inputStyle}
                />
              </div>
            )}

            {/* Método de pago */}
            <div style={{ marginBottom: paymentMethod === 'aseguradora' ? 10 : 18 }}>
              <label style={{ fontSize: 11.5, color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontWeight: 500, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Método de pago
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {PAYMENT_METHODS.map(pm => (
                  <button key={pm.value}
                    onClick={() => { setPaymentMethod(pm.value); setInsurer(''); setError(''); }}
                    style={{
                      padding: '8px 4px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                      fontFamily: 'Franklin Gothic', fontWeight: 500,
                      border: `1.5px solid ${paymentMethod === pm.value ? brand : tokens.border}`,
                      background: paymentMethod === pm.value ? brand + '10' : tokens.surfaceAlt,
                      color: paymentMethod === pm.value ? brand : tokens.textSecondary,
                      transition: 'all 0.15s',
                    }}
                  >
                    {pm.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Aseguradora */}
            {paymentMethod === 'aseguradora' && (
              <div style={{ marginBottom: 18 }}>
                <label style={{ fontSize: 11.5, color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontWeight: 500, display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                  Aseguradora
                </label>
                <input
                  placeholder="Ej. GNP, AXA, BBVA Seguros..."
                  value={insurer}
                  onChange={e => { setInsurer(e.target.value); setError(''); }}
                  style={inputStyle}
                />
              </div>
            )}
          </>
        )}

        {error && (
          <div style={{ background: '#D93A3A18', border: '1px solid #D93A3A', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12.5, color: '#D93A3A' }}>
            {error}
          </div>
        )}

        {/* Botones */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${tokens.border}`, background: 'none', color: tokens.textSecondary, fontSize: 13, fontFamily: 'Franklin Gothic', cursor: 'pointer' }}>
            Cancelar
          </button>
          {types.length > 0 && (
            <button onClick={handleSave} disabled={saving || !selectedTypeId}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: saving || !selectedTypeId ? tokens.surfaceAlt : brand,
                color: saving || !selectedTypeId ? tokens.textSecondary : '#fff',
                fontSize: 13, fontFamily: 'Franklin Gothic', fontWeight: 500, cursor: saving || !selectedTypeId ? 'default' : 'pointer',
                transition: 'background 0.15s',
              }}>
              {saving ? 'Guardando...' : '✓ Cerrar consulta'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
