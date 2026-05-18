import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SYSTEM_PROMPT = `Eres un asistente medico especializado en interpretar resultados de laboratorio clinico.
Tu unica tarea es extraer los valores numericos de analitos de un documento de laboratorio y devolverlos en JSON.

Reglas estrictas:
- Devuelve SOLO un array JSON valido, sin texto adicional, sin markdown, sin explicaciones
- Cada elemento debe tener exactamente estos campos: n, val, unit, range_, st, dir
- "n": nombre del analito en espanol (ej: "Glucosa", "Hemoglobina", "Creatinina")
- "val": valor numerico como numero (no string)
- "unit": unidad de medida (ej: "mg/dL", "g/dL", "mEq/L")
- "range_": rango de referencia como string (ej: "70-99", "12-17.5")
- "st": estado basado en si el valor esta fuera de rango: "ok" si normal, "hi" si alto, "lo" si bajo
- "dir": tendencia si hay valores anteriores, si no hay referencia usa "flat". Valores: "up", "down", "flat"
- Solo incluye analitos con valores numericos claros
- Si no puedes identificar un valor con certeza, omitelo
- Ignora datos del paciente, fechas, medico solicitante y cualquier texto no numerico

Ejemplo de output esperado:
[{"n":"Glucosa","val":112,"unit":"mg/dL","range_":"70-99","st":"hi","dir":"flat"},{"n":"Hemoglobina","val":14.2,"unit":"g/dL","range_":"12-17.5","st":"ok","dir":"flat"}]`;

type LabStatus = 'ok' | 'hi' | 'lo';
type LabDirection = 'up' | 'down' | 'flat';

type DocumentPayload = {
  bytes: Uint8Array;
  base64: string;
  mediaType: string;
};

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/\/+$/, '');
}

function inferMediaType(fileName?: string, fallback = 'application/octet-stream'): string {
  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return fallback;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function inferSt(val: number, rangeStr: string): LabStatus {
  if (!rangeStr) return 'ok';
  const ltMatch = rangeStr.match(/^<\s*([\d.]+)/);
  const gtMatch = rangeStr.match(/^>\s*([\d.]+)/);
  const rangeMatch = rangeStr.match(/([\d.]+)\s*[-\u2013]\s*([\d.]+)/);

  if (ltMatch) return val > parseFloat(ltMatch[1]) ? 'hi' : 'ok';
  if (gtMatch) return val < parseFloat(gtMatch[1]) ? 'lo' : 'ok';
  if (rangeMatch) {
    const min = parseFloat(rangeMatch[1]);
    const max = parseFloat(rangeMatch[2]);
    if (val < min) return 'lo';
    if (val > max) return 'hi';
  }
  return 'ok';
}

function extractJsonArray(rawText: string): any[] {
  const cleaned = rawText
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const start = cleaned.indexOf('[');
    const end = cleaned.lastIndexOf(']');
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return Array.isArray(parsed) ? parsed : [];
    }
    throw new Error('El modelo no devolvio un array JSON valido');
  }
}

async function fetchDocument(url: string, fileName?: string): Promise<DocumentPayload> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo leer el documento (${res.status})`);

  const buffer = await res.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const responseMediaType = (res.headers.get('content-type') || 'application/octet-stream').split(';')[0];
  const mediaType = inferMediaType(fileName, responseMediaType);

  return {
    bytes,
    base64: uint8ToBase64(bytes),
    mediaType,
  };
}

async function callAzureDocumentIntelligence(document: DocumentPayload): Promise<string> {
  const endpoint = Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT');
  const key = Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_KEY');
  if (!endpoint || !key) {
    throw new Error('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT y AZURE_DOCUMENT_INTELLIGENCE_KEY no configurados');
  }

  const apiVersion = Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_API_VERSION') || '2024-11-30';
  const model = Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_MODEL') || 'prebuilt-read';
  const analyzeUrl = `${normalizeEndpoint(endpoint)}/documentintelligence/documentModels/${encodeURIComponent(model)}:analyze?api-version=${encodeURIComponent(apiVersion)}`;

  const analyzeRes = await fetch(analyzeUrl, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': document.mediaType || 'application/octet-stream',
    },
    body: document.bytes,
  });

  if (analyzeRes.status !== 202) {
    const err = await analyzeRes.text();
    throw new Error(`Azure Document Intelligence error ${analyzeRes.status}: ${err}`);
  }

  const operationLocation = analyzeRes.headers.get('operation-location');
  if (!operationLocation) throw new Error('Azure Document Intelligence no devolvio operation-location');

  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const pollRes = await fetch(operationLocation, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
    });

    if (!pollRes.ok) {
      const err = await pollRes.text();
      throw new Error(`Azure Document Intelligence polling error ${pollRes.status}: ${err}`);
    }

    const data = await pollRes.json();
    if (data.status === 'succeeded') {
      const content = data.analyzeResult?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('Azure Document Intelligence no extrajo texto util del documento');
      }
      return content;
    }

    if (data.status === 'failed') {
      throw new Error(`Azure Document Intelligence fallo: ${JSON.stringify(data.error || data)}`);
    }
  }

  throw new Error('Azure Document Intelligence no termino dentro del tiempo esperado');
}

async function callAzureOpenAI(extractedText: string): Promise<string> {
  const endpoint = Deno.env.get('AZURE_OPENAI_ENDPOINT');
  const key = Deno.env.get('AZURE_OPENAI_API_KEY');
  const deployment = Deno.env.get('AZURE_OPENAI_DEPLOYMENT');
  if (!endpoint || !key || !deployment) {
    throw new Error('AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY y AZURE_OPENAI_DEPLOYMENT no configurados');
  }

  const apiVersion = Deno.env.get('AZURE_OPENAI_API_VERSION') || '2024-10-21';
  const url = `${normalizeEndpoint(endpoint)}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${encodeURIComponent(apiVersion)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'api-key': key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Extrae todos los resultados numericos de laboratorio del siguiente texto OCR/layout y devuelve solo el array JSON:\n\n${extractedText}`,
        },
      ],
      temperature: 0,
      max_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Azure OpenAI error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '[]';
}

async function callClaude(apiKey: string, content: any[]): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || '[]';
}

function buildClaudeDocumentContent(document: DocumentPayload, fileName?: string, documentUrl?: string): any[] {
  const ext = (fileName || documentUrl || '').split('.').pop()?.toLowerCase() || '';
  const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) || document.mediaType.startsWith('image/');

  if (isImage) {
    const validType = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(document.mediaType)
      ? document.mediaType
      : 'image/jpeg';
    return [
      { type: 'image', source: { type: 'base64', media_type: validType, data: document.base64 } },
      { type: 'text', text: 'Extrae todos los resultados numericos de laboratorio de esta imagen.' },
    ];
  }

  if (ext === 'pdf' || document.mediaType === 'application/pdf') {
    return [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: document.base64 } },
      { type: 'text', text: 'Extrae todos los resultados numericos de laboratorio de este documento PDF.' },
    ];
  }

  return [
    { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: document.base64 } },
    { type: 'text', text: 'Extrae todos los resultados numericos de laboratorio.' },
  ];
}

async function extractWithConfiguredProviders(document: DocumentPayload, fileName?: string, documentUrl?: string) {
  const hasAzureDocumentIntelligence =
    Boolean(Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT')) &&
    Boolean(Deno.env.get('AZURE_DOCUMENT_INTELLIGENCE_KEY'));
  const hasAzureOpenAI =
    Boolean(Deno.env.get('AZURE_OPENAI_ENDPOINT')) &&
    Boolean(Deno.env.get('AZURE_OPENAI_API_KEY')) &&
    Boolean(Deno.env.get('AZURE_OPENAI_DEPLOYMENT'));
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');

  if (hasAzureDocumentIntelligence) {
    try {
      const extractedText = await callAzureDocumentIntelligence(document);
      if (hasAzureOpenAI) {
        return {
          rawText: await callAzureOpenAI(extractedText),
          extractor: 'azure_document_intelligence+azure_openai',
        };
      }

      if (anthropicKey) {
        return {
          rawText: await callClaude(anthropicKey, [
            {
              type: 'text',
              text: `Extrae todos los resultados numericos de laboratorio del siguiente texto OCR/layout y devuelve solo el array JSON:\n\n${extractedText}`,
            },
          ]),
          extractor: 'azure_document_intelligence+claude',
        };
      }

      throw new Error('Azure Document Intelligence extrajo texto, pero no hay Azure OpenAI ni Claude configurado para convertirlo a JSON');
    } catch (err) {
      if (!anthropicKey) throw err;
      console.warn('Azure extraction failed, falling back to Claude direct document analysis', err);
    }
  }

  if (!anthropicKey) {
    throw new Error('No hay extractor configurado: configure Azure Document Intelligence + Azure OpenAI, o ANTHROPIC_API_KEY');
  }

  return {
    rawText: await callClaude(anthropicKey, buildClaudeDocumentContent(document, fileName, documentUrl)),
    extractor: 'claude_direct',
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    const { patient_id, document_url, file_name, pdf_path, bucket } = await req.json();

    if (!patient_id || !document_url) {
      return new Response(JSON.stringify({ error: 'patient_id y document_url son requeridos' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const document = await fetchDocument(document_url, file_name);
    const { rawText, extractor } = await extractWithConfiguredProviders(document, file_name, document_url);

    let analitos: any[] = [];
    try {
      analitos = extractJsonArray(rawText);
    } catch (err) {
      return new Response(JSON.stringify({
        error: err instanceof Error ? err.message : 'El modelo no devolvio JSON valido',
        raw: rawText,
        extractor,
      }), {
        status: 422,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const today = new Date().toISOString().split('T')[0];
    let inserted = 0;
    const labIds: string[] = [];

    for (const a of analitos) {
      if (!a.n || a.val === undefined || a.val === null) continue;
      const val = typeof a.val === 'number' ? a.val : parseFloat(a.val);
      if (Number.isNaN(val)) continue;

      const st: LabStatus = ['ok', 'hi', 'lo'].includes(a.st)
        ? a.st
        : inferSt(val, a.range_ || '');
      const dir: LabDirection = ['up', 'down', 'flat'].includes(a.dir) ? a.dir : 'flat';

      const { data: prevRow } = await db
        .from('labs')
        .select('val, id')
        .eq('patient_id', patient_id)
        .eq('n', a.n)
        .order('taken_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const prevVal = prevRow?.val !== undefined && prevRow?.val !== null ? Number(prevRow.val) : null;
      const deltaNum = prevVal !== null ? +(val - prevVal).toFixed(2) : null;
      const delta = deltaNum !== null ? (deltaNum > 0 ? `+${deltaNum}` : `${deltaNum}`) : null;

      const payload = {
        patient_id,
        n: a.n,
        val,
        unit: a.unit || '',
        range_: a.range_ || '',
        st,
        dir,
        taken_at: today,
        prev: prevVal,
        delta,
        pdf_path: pdf_path || null,
      };

      if (prevRow?.id) {
        await db.from('labs').update(payload).eq('id', prevRow.id);
        labIds.push(prevRow.id);
      } else {
        const { data: insertedLab } = await db
          .from('labs')
          .insert(payload)
          .select('id')
          .single();
        if (insertedLab?.id) labIds.push(insertedLab.id);
      }
      inserted++;
    }

    if (inserted > 0) {
      await db.from('patient_history').insert({
        patient_id,
        type: 'documento',
        title: `Labs extraidos automaticamente${file_name ? `: ${file_name}` : ''}`,
        description: `${inserted} analito${inserted === 1 ? '' : 's'} detectado${inserted === 1 ? '' : 's'}${bucket ? ` desde ${bucket}` : ''} via ${extractor}`,
        icon: 'flask',
        lab_id: labIds[0] || null,
        source_table: labIds[0] ? 'labs' : 'patient_history',
        source_id: labIds[0] || crypto.randomUUID(),
        event_type: 'lab_extraction_summary',
        occurred_at: new Date().toISOString(),
        metadata: {
          extractor,
          file_name,
          pdf_path: pdf_path || null,
          bucket: bucket || null,
          inserted_count: inserted,
          lab_ids: labIds,
        },
      }).throwOnError().catch(() => {});
    }

    return new Response(
      JSON.stringify({ inserted, analitos: analitos.map((a: any) => a.n).filter(Boolean), extractor }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
