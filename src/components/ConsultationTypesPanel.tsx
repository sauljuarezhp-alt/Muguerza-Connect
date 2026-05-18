import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import {
  getAllConsultationTypes, createConsultationType,
  updateConsultationType, deactivateConsultationType,
  type ConsultationType,
} from '../api/consultationTypes';
import { getSuggestedTemplates, CATEGORY_LABEL, type ConsultationTemplate } from '../data/consultationTemplates';

interface Props { doctorId: string; specialty: string; brand: string; }

const CATEGORIES = ['primera_vez', 'subsecuente', 'urgencia'] as const;

type FormState = { name: string; category: 'primera_vez' | 'subsecuente' | 'urgencia'; baseFee: string; minFee: string; maxFee: string; };
const emptyForm: FormState = { name: '', category: 'subsecuente', baseFee: '', minFee: '', maxFee: '' };

export function ConsultationTypesPanel({ doctorId, specialty, brand }: Props) {
  const { tokens } = useTheme();
  const [types, setTypes] = useState<ConsultationType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggested = getSuggestedTemplates(specialty);

  async function reload() {
    setLoading(true);
    getAllConsultationTypes(doctorId).then(t => { setTypes(t); setLoading(false); });
  }

  useEffect(() => { reload(); }, [doctorId]);

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(true);
  }

  function openEdit(t: ConsultationType) {
    setEditId(t.id);
    setForm({
      name: t.name,
      category: t.category,
      baseFee: String(t.baseFee),
      minFee: t.minFee != null ? String(t.minFee) : '',
      maxFee: t.maxFee != null ? String(t.maxFee) : '',
    });
    setError('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('El nombre es obligatorio.'); return; }
    const baseFee = parseFloat(form.baseFee);
    if (isNaN(baseFee) || baseFee < 0) { setError('El precio base debe ser un número ≥ 0.'); return; }
    setSaving(true); setError('');
    try {
      if (editId) {
        await updateConsultationType(editId, {
          name: form.name.trim(),
          category: form.category,
          baseFee,
          minFee: form.minFee ? parseFloat(form.minFee) : null,
          maxFee: form.maxFee ? parseFloat(form.maxFee) : null,
        });
      } else {
        await createConsultationType({
          doctorId, name: form.name.trim(), category: form.category, baseFee,
          minFee: form.minFee ? parseFloat(form.minFee) : undefined,
          maxFee: form.maxFee ? parseFloat(form.maxFee) : undefined,
          isCustom: true,
        });
      }
      setShowForm(false);
      reload();
    } catch (e: any) {
      setError(e.message || 'Error al guardar.');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddSuggestion(tmpl: ConsultationTemplate) {
    const exists = types.some(t => t.name === tmpl.name && t.active);
    if (exists) return;
    await createConsultationType({
      doctorId, name: tmpl.name, category: tmpl.category,
      baseFee: 0, isCustom: false, specialtyTemplate: tmpl.specialtyTemplate,
    });
    reload();
  }

  const inputStyle = {
    width: '100%', padding: '7px 10px', borderRadius: 7,
    border: `1px solid ${tokens.border}`, background: tokens.inputBg,
    color: tokens.text, fontSize: 13, fontFamily: 'Franklin Gothic',
    outline: 'none', boxSizing: 'border-box' as const,
  };

  const activeTypes = types.filter(t => t.active);
  const inactiveTypes = types.filter(t => !t.active);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 14, color: tokens.text }}>
          Tipos de consulta y precios
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => setShowSuggestions(s => !s)}
            style={{ padding: '6px 12px', borderRadius: 7, border: `1px solid ${tokens.border}`, background: tokens.surfaceAlt, color: tokens.textSecondary, fontSize: 12, fontFamily: 'Franklin Gothic', fontWeight: 500, cursor: 'pointer' }}>
            {showSuggestions ? 'Ocultar sugerencias' : '+ Sugerencias'}
          </button>
          <button onClick={openCreate}
            style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: brand, color: '#fff', fontSize: 12, fontFamily: 'Franklin Gothic', fontWeight: 500, cursor: 'pointer' }}>
            + Nuevo tipo
          </button>
        </div>
      </div>

      {/* Sugerencias por especialidad */}
      {showSuggestions && (
        <div style={{ background: tokens.surfaceAlt, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ fontSize: 11.5, color: tokens.textSecondary, fontFamily: 'Franklin Gothic', fontWeight: 500, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 10 }}>
            Sugerencias para {specialty}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {suggested.map(tmpl => {
              const alreadyActive = types.some(t => t.name === tmpl.name && t.active);
              return (
                <button key={tmpl.name}
                  onClick={() => !alreadyActive && handleAddSuggestion(tmpl)}
                  disabled={alreadyActive}
                  style={{
                    padding: '5px 11px', borderRadius: 999, fontSize: 12,
                    fontFamily: 'Franklin Gothic', fontWeight: 500, cursor: alreadyActive ? 'default' : 'pointer',
                    border: `1px solid ${alreadyActive ? tokens.border : brand}`,
                    background: alreadyActive ? tokens.surface : brand + '12',
                    color: alreadyActive ? tokens.textTertiary : brand,
                    opacity: alreadyActive ? 0.6 : 1,
                  }}>
                  {alreadyActive ? '✓ ' : '+ '}{tmpl.name}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Formulario */}
      {showForm && (
        <div style={{ background: tokens.surfaceAlt, borderRadius: 10, padding: '14px 16px', marginBottom: 14, border: `1px solid ${brand}40` }}>
          <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, color: tokens.text, marginBottom: 12 }}>
            {editId ? 'Editar tipo' : 'Nuevo tipo de consulta'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ fontSize: 11, color: tokens.textSecondary, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Nombre visible</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ej. Consulta subsecuente" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: tokens.textSecondary, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Categoría interna</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as FormState['category'] }))}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: tokens.textSecondary, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Precio base (MXN)</label>
              <input type="number" min={0} step={50} value={form.baseFee} onChange={e => setForm(f => ({ ...f, baseFee: e.target.value }))} placeholder="0" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: tokens.textSecondary, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Precio mínimo (opcional)</label>
              <input type="number" min={0} step={50} value={form.minFee} onChange={e => setForm(f => ({ ...f, minFee: e.target.value }))} placeholder="—" style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, color: tokens.textSecondary, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Precio máximo (opcional)</label>
              <input type="number" min={0} step={50} value={form.maxFee} onChange={e => setForm(f => ({ ...f, maxFee: e.target.value }))} placeholder="—" style={inputStyle} />
            </div>
          </div>
          {error && <div style={{ fontSize: 12, color: '#D93A3A', marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '6px 14px', borderRadius: 7, border: `1px solid ${tokens.border}`, background: 'none', color: tokens.textSecondary, fontSize: 12, fontFamily: 'Franklin Gothic', cursor: 'pointer' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving}
              style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: brand, color: '#fff', fontSize: 12, fontFamily: 'Franklin Gothic', fontWeight: 500, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {/* Lista activos */}
      {loading ? (
        <div style={{ fontSize: 13, color: tokens.textSecondary, padding: '16px 0' }}>Cargando tipos...</div>
      ) : activeTypes.length === 0 && !showForm ? (
        <div style={{ background: tokens.surfaceAlt, borderRadius: 10, padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: 24, marginBottom: 6 }}>💊</div>
          <div style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, color: tokens.text, marginBottom: 4 }}>
            Sin tipos de consulta configurados
          </div>
          <div style={{ fontSize: 12, color: tokens.textSecondary }}>
            Agrega tipos con sus precios para que la secretaria pueda registrar ingresos al cerrar citas.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activeTypes.map(t => (
            <div key={t.id} style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRadius: 9, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: 'Franklin Gothic', fontWeight: 500, fontSize: 13, color: tokens.text }}>{t.name}</span>
                <span style={{ fontSize: 11, color: tokens.textSecondary, marginLeft: 8 }}>
                  {CATEGORY_LABEL[t.category]}
                  {t.minFee != null && t.maxFee != null && ` · ${t.minFee.toLocaleString()}–${t.maxFee.toLocaleString()}`}
                </span>
              </div>
              <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: 13, fontWeight: 500, color: brand }}>
                ${t.baseFee.toLocaleString('es-MX')}
              </span>
              <button onClick={() => openEdit(t)}
                style={{ background: 'none', border: `1px solid ${tokens.border}`, borderRadius: 6, padding: '3px 9px', fontSize: 11, color: tokens.textSecondary, cursor: 'pointer', fontFamily: 'Franklin Gothic' }}>
                Editar
              </button>
              <button onClick={async () => { await deactivateConsultationType(t.id); reload(); }}
                style={{ background: 'none', border: `1px solid ${tokens.border}`, borderRadius: 6, padding: '3px 9px', fontSize: 11, color: '#D93A3A', cursor: 'pointer', fontFamily: 'Franklin Gothic' }}>
                Desactivar
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Inactivos colapsables */}
      {inactiveTypes.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary style={{ fontSize: 11.5, color: tokens.textSecondary, cursor: 'pointer', fontFamily: 'Franklin Gothic', fontWeight: 500, letterSpacing: 0.5 }}>
            {inactiveTypes.length} tipo{inactiveTypes.length !== 1 ? 's' : ''} inactivo{inactiveTypes.length !== 1 ? 's' : ''}
          </summary>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {inactiveTypes.map(t => (
              <div key={t.id} style={{ background: tokens.surfaceAlt, border: `1px solid ${tokens.border}`, borderRadius: 9, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 12, opacity: 0.6 }}>
                <div style={{ flex: 1, fontSize: 12.5, color: tokens.textSecondary, fontFamily: 'Franklin Gothic' }}>{t.name}</div>
                <button onClick={async () => { await updateConsultationType(t.id, { active: true }); reload(); }}
                  style={{ background: 'none', border: `1px solid ${tokens.border}`, borderRadius: 6, padding: '3px 9px', fontSize: 11, color: brand, cursor: 'pointer', fontFamily: 'Franklin Gothic' }}>
                  Reactivar
                </button>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
