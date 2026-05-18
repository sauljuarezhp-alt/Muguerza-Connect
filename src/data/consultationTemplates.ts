export interface ConsultationTemplate {
  name: string;
  category: 'primera_vez' | 'subsecuente' | 'urgencia';
  specialtyTemplate: string;
}

export const CONSULTATION_TEMPLATES: Record<string, ConsultationTemplate[]> = {
  'Medicina General': [
    { name: 'Primera consulta',      category: 'primera_vez',  specialtyTemplate: 'medicina_general' },
    { name: 'Consulta subsecuente',  category: 'subsecuente',  specialtyTemplate: 'medicina_general' },
    { name: 'Chequeo básico',        category: 'subsecuente',  specialtyTemplate: 'medicina_general' },
    { name: 'Chequeo completo',      category: 'subsecuente',  specialtyTemplate: 'medicina_general' },
    { name: 'Urgencia',              category: 'urgencia',     specialtyTemplate: 'medicina_general' },
  ],
  'Medicina Interna': [
    { name: 'Primera consulta',      category: 'primera_vez',  specialtyTemplate: 'medicina_interna' },
    { name: 'Consulta subsecuente',  category: 'subsecuente',  specialtyTemplate: 'medicina_interna' },
    { name: 'Control crónico',       category: 'subsecuente',  specialtyTemplate: 'medicina_interna' },
    { name: 'Urgencia',              category: 'urgencia',     specialtyTemplate: 'medicina_interna' },
  ],
  'Pediatría': [
    { name: 'Primera consulta pediátrica',         category: 'primera_vez', specialtyTemplate: 'pediatria' },
    { name: 'Consulta pediátrica subsecuente',     category: 'subsecuente', specialtyTemplate: 'pediatria' },
    { name: 'Control niño sano',                   category: 'subsecuente', specialtyTemplate: 'pediatria' },
    { name: 'Chequeo completo pediátrico',         category: 'subsecuente', specialtyTemplate: 'pediatria' },
    { name: 'Urgencia pediátrica',                 category: 'urgencia',    specialtyTemplate: 'pediatria' },
  ],
  'Ginecología': [
    { name: 'Primera consulta ginecológica',       category: 'primera_vez', specialtyTemplate: 'ginecologia' },
    { name: 'Consulta ginecológica subsecuente',   category: 'subsecuente', specialtyTemplate: 'ginecologia' },
    { name: 'Ultrasonido',                         category: 'subsecuente', specialtyTemplate: 'ginecologia' },
    { name: 'Consulta + ultrasonido',              category: 'subsecuente', specialtyTemplate: 'ginecologia' },
    { name: 'Papanicolau',                         category: 'subsecuente', specialtyTemplate: 'ginecologia' },
    { name: 'Control prenatal',                    category: 'subsecuente', specialtyTemplate: 'ginecologia' },
    { name: 'Urgencia ginecológica',               category: 'urgencia',    specialtyTemplate: 'ginecologia' },
  ],
  'Traumatología': [
    { name: 'Primera consulta traumatología',      category: 'primera_vez', specialtyTemplate: 'traumatologia' },
    { name: 'Consulta subsecuente traumatología',  category: 'subsecuente', specialtyTemplate: 'traumatologia' },
    { name: 'Revisión postoperatoria',             category: 'subsecuente', specialtyTemplate: 'traumatologia' },
    { name: 'Infiltración',                        category: 'subsecuente', specialtyTemplate: 'traumatologia' },
    { name: 'Urgencia traumatología',              category: 'urgencia',    specialtyTemplate: 'traumatologia' },
  ],
  'Cardiología': [
    { name: 'Primera consulta cardiológica',       category: 'primera_vez', specialtyTemplate: 'cardiologia' },
    { name: 'Consulta cardiológica subsecuente',   category: 'subsecuente', specialtyTemplate: 'cardiologia' },
    { name: 'Control arritmia/HTA',                category: 'subsecuente', specialtyTemplate: 'cardiologia' },
    { name: 'Urgencia cardiológica',               category: 'urgencia',    specialtyTemplate: 'cardiologia' },
  ],
  'Dermatología': [
    { name: 'Primera consulta dermatológica',      category: 'primera_vez', specialtyTemplate: 'dermatologia' },
    { name: 'Consulta dermatológica subsecuente',  category: 'subsecuente', specialtyTemplate: 'dermatologia' },
    { name: 'Procedimiento menor',                 category: 'subsecuente', specialtyTemplate: 'dermatologia' },
  ],
};

// Devuelve sugerencias para la especialidad dada; fallback a Medicina General
export function getSuggestedTemplates(specialty: string): ConsultationTemplate[] {
  const key = Object.keys(CONSULTATION_TEMPLATES).find(k =>
    specialty.toLowerCase().includes(k.toLowerCase()) ||
    k.toLowerCase().includes(specialty.toLowerCase())
  );
  return CONSULTATION_TEMPLATES[key ?? 'Medicina General'] ?? CONSULTATION_TEMPLATES['Medicina General'];
}

export const CATEGORY_LABEL: Record<string, string> = {
  primera_vez: 'Primera vez',
  subsecuente: 'Subsecuente',
  urgencia: 'Urgencia',
};
