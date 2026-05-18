export interface Analito {
  name: string;
  abbr: string;
  unit: string;
  range: string;
  low: number;    // por debajo → Bajo
  min: number;    // por debajo → Crítico bajo
  max: number;    // por encima → Alto
  high: number;   // por encima → Crítico
}

export const ANALITOS: Analito[] = [
  // ── Glucosa y metabolismo
  { name: 'Glucosa',                abbr: 'GLU',  unit: 'mg/dL',   range: '70–99',      min: 40,   low: 70,   max: 99,   high: 500  },
  { name: 'Hemoglobina glucosilada',abbr: 'HbA1c',unit: '%',       range: '4.0–5.6',    min: 3.0,  low: 4.0,  max: 5.6,  high: 10.0 },
  { name: 'Insulina',               abbr: 'INS',  unit: 'µU/mL',   range: '2.6–24.9',   min: 1.0,  low: 2.6,  max: 24.9, high: 100  },
  { name: 'Urea',                   abbr: 'UREA', unit: 'mg/dL',   range: '15–40',      min: 5,    low: 15,   max: 40,   high: 200  },
  { name: 'BUN (nitrógeno ureico)', abbr: 'BUN',  unit: 'mg/dL',   range: '7–20',       min: 2,    low: 7,    max: 20,   high: 100  },
  { name: 'Creatinina',             abbr: 'CR',   unit: 'mg/dL',   range: '0.7–1.2',    min: 0.3,  low: 0.7,  max: 1.2,  high: 10.0 },
  { name: 'Ácido úrico',            abbr: 'AU',   unit: 'mg/dL',   range: '3.4–7.0',    min: 1.0,  low: 3.4,  max: 7.0,  high: 15.0 },

  // ── Electrolitos
  { name: 'Sodio',                  abbr: 'NA',   unit: 'mEq/L',   range: '136–145',    min: 120,  low: 136,  max: 145,  high: 160  },
  { name: 'Potasio',                abbr: 'K',    unit: 'mEq/L',   range: '3.5–5.0',    min: 2.5,  low: 3.5,  max: 5.0,  high: 6.5  },
  { name: 'Cloro',                  abbr: 'CL',   unit: 'mEq/L',   range: '98–107',     min: 85,   low: 98,   max: 107,  high: 120  },
  { name: 'Calcio total',           abbr: 'CA',   unit: 'mg/dL',   range: '8.5–10.5',   min: 6.0,  low: 8.5,  max: 10.5, high: 14.0 },
  { name: 'Magnesio',               abbr: 'MG',   unit: 'mg/dL',   range: '1.7–2.2',    min: 1.0,  low: 1.7,  max: 2.2,  high: 5.0  },
  { name: 'Fósforo',                abbr: 'P',    unit: 'mg/dL',   range: '2.5–4.5',    min: 1.0,  low: 2.5,  max: 4.5,  high: 8.0  },
  { name: 'Bicarbonato',            abbr: 'HCO3', unit: 'mEq/L',   range: '22–29',      min: 10,   low: 22,   max: 29,   high: 40   },

  // ── Función hepática
  { name: 'ALT (TGP)',              abbr: 'ALT',  unit: 'U/L',     range: '7–56',       min: 0,    low: 7,    max: 56,   high: 500  },
  { name: 'AST (TGO)',              abbr: 'AST',  unit: 'U/L',     range: '10–40',      min: 0,    low: 10,   max: 40,   high: 500  },
  { name: 'Fosfatasa alcalina',     abbr: 'FA',   unit: 'U/L',     range: '44–147',     min: 0,    low: 44,   max: 147,  high: 1000 },
  { name: 'GGT',                    abbr: 'GGT',  unit: 'U/L',     range: '8–61',       min: 0,    low: 8,    max: 61,   high: 500  },
  { name: 'Bilirrubina total',      abbr: 'BT',   unit: 'mg/dL',   range: '0.2–1.2',    min: 0,    low: 0.2,  max: 1.2,  high: 15.0 },
  { name: 'Bilirrubina directa',    abbr: 'BD',   unit: 'mg/dL',   range: '0.0–0.3',    min: 0,    low: 0.0,  max: 0.3,  high: 10.0 },
  { name: 'Albúmina',               abbr: 'ALB',  unit: 'g/dL',    range: '3.5–5.0',    min: 1.5,  low: 3.5,  max: 5.0,  high: 6.0  },
  { name: 'Proteínas totales',      abbr: 'PT',   unit: 'g/dL',    range: '6.3–8.2',    min: 3.0,  low: 6.3,  max: 8.2,  high: 12.0 },

  // ── Lípidos
  { name: 'Colesterol total',       abbr: 'COL',  unit: 'mg/dL',   range: '<200',       min: 0,    low: 100,  max: 200,  high: 300  },
  { name: 'LDL',                    abbr: 'LDL',  unit: 'mg/dL',   range: '<100',       min: 0,    low: 50,   max: 100,  high: 190  },
  { name: 'HDL',                    abbr: 'HDL',  unit: 'mg/dL',   range: '>40 H / >50 M', min: 20, low: 40,  max: 100,  high: 200  },
  { name: 'Triglicéridos',          abbr: 'TG',   unit: 'mg/dL',   range: '<150',       min: 0,    low: 50,   max: 150,  high: 500  },

  // ── Biometría hemática
  { name: 'Hemoglobina',            abbr: 'HB',   unit: 'g/dL',    range: '12–17.5',    min: 6.0,  low: 12.0, max: 17.5, high: 22.0 },
  { name: 'Hematocrito',            abbr: 'HTO',  unit: '%',       range: '36–52',      min: 18,   low: 36,   max: 52,   high: 65   },
  { name: 'Leucocitos',             abbr: 'WBC',  unit: 'x10³/µL', range: '4.5–11.0',   min: 1.0,  low: 4.5,  max: 11.0, high: 30.0 },
  { name: 'Plaquetas',              abbr: 'PLT',  unit: 'x10³/µL', range: '150–400',    min: 20,   low: 150,  max: 400,  high: 1000 },
  { name: 'Eritrocitos',            abbr: 'RBC',  unit: 'x10⁶/µL', range: '4.2–5.9',    min: 2.0,  low: 4.2,  max: 5.9,  high: 8.0  },
  { name: 'Neutrófilos',            abbr: 'NEU',  unit: '%',       range: '45–75',      min: 10,   low: 45,   max: 75,   high: 95   },
  { name: 'Linfocitos',             abbr: 'LIN',  unit: '%',       range: '20–45',      min: 5,    low: 20,   max: 45,   high: 80   },
  { name: 'Monocitos',              abbr: 'MON',  unit: '%',       range: '2–10',       min: 0,    low: 2,    max: 10,   high: 25   },
  { name: 'VCM',                    abbr: 'VCM',  unit: 'fL',      range: '80–100',     min: 50,   low: 80,   max: 100,  high: 130  },

  // ── Tiroides y hormonas
  { name: 'TSH',                    abbr: 'TSH',  unit: 'µIU/mL',  range: '0.4–4.0',    min: 0.01, low: 0.4,  max: 4.0,  high: 10.0 },
  { name: 'T4 libre',               abbr: 'T4L',  unit: 'ng/dL',   range: '0.8–1.8',    min: 0.1,  low: 0.8,  max: 1.8,  high: 4.0  },
  { name: 'T3 libre',               abbr: 'T3L',  unit: 'pg/mL',   range: '2.3–4.2',    min: 0.5,  low: 2.3,  max: 4.2,  high: 10.0 },

  // ── Inflamación y coagulación
  { name: 'PCR (Proteína C reactiva)', abbr: 'PCR', unit: 'mg/L',  range: '<5',         min: 0,    low: 0,    max: 5,    high: 100  },
  { name: 'VSG',                    abbr: 'VSG',  unit: 'mm/h',    range: '0–20',       min: 0,    low: 0,    max: 20,   high: 100  },
  { name: 'Fibrinógeno',            abbr: 'FIB',  unit: 'mg/dL',   range: '200–400',    min: 50,   low: 200,  max: 400,  high: 800  },
  { name: 'INR',                    abbr: 'INR',  unit: '',        range: '0.8–1.2',    min: 0.5,  low: 0.8,  max: 1.2,  high: 4.0  },
  { name: 'Tiempo de protrombina',  abbr: 'TP',   unit: 's',       range: '11–13',      min: 5,    low: 11,   max: 13,   high: 30   },
];

export function calcStatus(a: Analito, val: number): 'ok' | 'hi' | 'lo' {
  if (val < a.low) return 'lo';
  if (val > a.max) return 'hi';
  return 'ok';
}
