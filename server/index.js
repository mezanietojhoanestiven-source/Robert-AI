import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Groq } from 'groq-sdk';
import rateLimit from 'express-rate-limit';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'scammers.json');

/** Load environment variables */
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

// Aumentamos a 50mb para soportar arrays de imágenes en base64
app.use(express.json({ limit: '50mb' }));

if (!process.env.GROQ_API_KEY) {
  console.warn('⚠️ ADVERTENCIA: GROQ_API_KEY no está definida en .env');
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Has superado el límite de peticiones. Por favor, inténtalo de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/analyze', apiLimiter);

const DEFAULT_DB = {
  extractedIdentifiers: [],
  totalAnalyses: 0,
  scamsDetected: 0,
  recentScams: []
};

async function loadDB() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return DEFAULT_DB;
  }
}

async function saveDB(data) {
  await fs.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

async function initDB() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await saveDB(DEFAULT_DB);
  }
}
initDB();

async function getBlacklist() {
  const db = await loadDB();
  return db.extractedIdentifiers || [];
}

async function updateOnAnalysis(result) {
  const db = await loadDB();
  db.totalAnalyses = (db.totalAnalyses || 0) + 1;

  if (result.level === 'ALTO') {
    db.scamsDetected = (db.scamsDetected || 0) + 1;
    
    // Add to extracted identifiers (blacklist)
    if (result.extractedIdentifiers && result.extractedIdentifiers.length > 0) {
      const added = new Set(db.extractedIdentifiers);
      result.extractedIdentifiers.forEach(id => {
        // Normalize: if it looks like a phone number, remove non-digits (except +)
        const normalized = id.includes('@') || id.includes('http') ? id.trim() : id.replace(/[\s\-()]/g, '');
        added.add(normalized);
      });
      db.extractedIdentifiers = Array.from(added);
    }

    // Add to recent feed (anonymized)
    const newEntry = {
      id: Date.now().toString(36),
      type: result.scamType,
      location: result.osint_location || "Internacional",
      timestamp: new Date().toISOString()
    };
    db.recentScams = [newEntry, ...(db.recentScams || [])].slice(0, 10);
  }

  await saveDB(db);
}

const getSystemPrompt = (blacklistAlert) => `
Eres "Robert", el agente de inteligencia artificial visual definitivo contra estafas y fraudes cibernéticos. 
Tu misión es cazar estafadores analizando capturas de pantalla o textos. Posees un conocimiento profundo de psicología humana, manipulación emocional, y todas las técnicas de fraude.

${blacklistAlert}
Si hay una alerta de lista negra arriba, levanta ALERTA MÁXIMA ROJA inmediatamente.

Reglas de Análisis:
1. Cadena de Pensamiento Obligatoria: Antes de dar un puntaje, DEBES generar tu análisis paso a paso en el campo oculto "reasoning". Busca tácticas de urgencia, manipulación, ofertas irreales, cuentas extrañas o enlaces sospechosos.
2. Basado en tu análisis previo (reasoning), evalúa el riesgo real del 0 al 100. Sé estricto. (70-100 es ALTO, 40-69 es MEDIO, 0-39 es BAJO/Seguro).
3. Genera una línea de tiempo (timeline) proyectando QUÉ PASARÍA SI LA VÍCTIMA CAE. Debe ser cruda y realista.
4. Identifica de 1 a 3 indicadores clave de por qué es una estafa.
5. Extrae identificadores maliciosos (teléfonos, cuentas, correos, links, @alias) CLARAMENTE VISIBLES y ponlos en "extractedIdentifiers".
6. Extrae "red flags" (banderas rojas) textuales detectadas a "flaggedWords".

7. Rastreo OSINT: Analiza los números de teléfono extraídos. Determina el país y, si es posible, la ciudad o región de origen usando el código indicativo internacional (ej. +57 = Colombia, +234 = Nigeria, +52 = México). Retorna estos datos en "osint_location" (string vacío si no hay número).

IMPORTANTE: DEBES DEVOLVER EXCLUSIVAMENTE UN OBJETO JSON VÁLIDO. NINGÚN TEXTO ADICIONAL.
Estructura EXCLUSIVA del JSON:
{
  "reasoning": "El mensaje exige dinero urgente usando un sentido de urgencia falso...",
  "score": 95,
  "level": "ALTO", 
  "scamType": "💰 Fraude de Inversión",
  "indicators": [ { "icon": "❌", "title": "Urgencia Artificial", "description": "Buscan presionarte..." } ],
  "timeline": [ { "day": "Día 1", "title": "Robo Inicial", "description": "Traspasas el dinero...", "color": "dark-red" } ],
  "explanations": [ { "icon": "🧠", "title": "Manipulación del miedo", "description": "Juegan con tu temor..." } ],
  "flaggedWords": ["transferencia", "urgente"],
  "extractedIdentifiers": ["+1234567890", "link-falso.com"],
    "osint_location": "Nigeria"
}

Nota: "level" solo puede ser "ALTO", "MEDIO" o "BAJO". "color" de timeline: "green", "yellow", "red", "dark-red". Solo devuelve el JSON, NUNCA text markdown. Si es seguro, nivel BAJO, score bajo, y extractedIdentifiers vacío.
`;

app.post('/api/analyze', async (req, res) => {
  const { message, images } = req.body; // images array of base64 strings

  if ((!message || typeof message !== 'string') && (!images || images.length === 0)) {
    return res.status(400).json({ error: 'Debes enviar texto o capturas de pantalla' });
  }

  // Sanitización de texto
  let safeMessage = message ? message.trim() : "";
  if (safeMessage.length > 3000) safeMessage = safeMessage.substring(0, 3000) + '... [TEXTO TRUNCADO]';

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: 'La API Key de Groq no está configurada.' });
  }

  // Leer memoria colectiva (blacklist)
  const blacklist = await getBlacklist();
  
  // Verificación local previa
  let matchFound = false;
  let matchingIdentifier = "";
  if (safeMessage) {
    const identifiersInText = safeMessage.match(/[+\d\s-]{7,20}|@[a-zA-Z0-9._]+|https?:\/\/[^\s]+/g) || [];
    for (const id of identifiersInText) {
      const normalized = id.includes('@') || id.includes('http') ? id.trim() : id.replace(/[\s\-()]/g, '');
      if (blacklist.includes(normalized)) {
        matchFound = true;
        matchingIdentifier = normalized;
        break;
      }
    }
  }

  // ─── CONSTRUCCIÓN DEL PROMPT MULTIMODAL ───
  const hasImages = images && images.length > 0;
  // Usamos Llama 3.2 Vision si hay imágenes, o Llama 3.3 para texto puro
  const modelToUse = hasImages ? 'llama-3.2-11b-vision-preview' : 'llama-3.3-70b-versatile';
  
  const systemPrompt = getSystemPrompt(matchFound ? `OJO: EL IDENTIFICADOR "${matchingIdentifier}" YA ESTÁ EN LA LISTA NEGRA. ESTO ES UNA ESTAFA CONFIRMADA.` : "");
  
  const messagesPayload = [];

  // IMPORTANTE: Algunos modelos Vision en Groq fallan si se usa el rol 'system' junto con imágenes. 
  // Para máxima compatibilidad, incluimos las instrucciones en el primer mensaje de 'user'.
  if (!hasImages) {
    messagesPayload.push({ role: 'system', content: systemPrompt });
  }

  // Construir contenido del usuario
  const userContent = [];
  
  // Si hay imágenes, el prompt de sistema va aquí dentro
  if (hasImages) {
    userContent.push({ 
      type: 'text', 
      text: "INSTRUCCIONES DE SISTEMA:\n" + systemPrompt + "\n\nMENSAJE DEL USUARIO A ANALIZAR:\n" 
    });
  }

  // Agregar texto si existe
  let textPrompt = "Analiza el siguiente contenido ";
  textPrompt += hasImages ? "junto con las imágenes adjuntas. " : "proporcionado. ";
  textPrompt += "Busca patrones de fraude, manipulación o estafa. DEBES RESPONDER SOLO EN FORMATO JSON.\n\nContenido: ";
  textPrompt += safeMessage || "[Sin texto, analizar solo imágenes]";
  
  userContent.push({ type: 'text', text: textPrompt });

  // Agregar imágenes si existen
  if (hasImages) {
    images.forEach((imgBase64) => {
      const url = imgBase64.startsWith('data:') ? imgBase64 : `data:image/png;base64,${imgBase64}`;
      userContent.push({
        type: 'image_url',
        image_url: { url: url }
      });
    });
  }

  messagesPayload.push({ role: 'user', content: userContent });

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: messagesPayload,
      model: modelToUse,
      temperature: 0.1, 
      max_tokens: 2000,
      response_format: { type: "json_object" }
    });

    const aiResponseContent = chatCompletion.choices[0]?.message?.content;
    if (!aiResponseContent) throw new Error('Respuesta vacía desde Groq');

    const jsonResult = JSON.parse(aiResponseContent);

    // Validación básica del formato esperado
    if (jsonResult.score === undefined || !jsonResult.scamType) {
      throw new Error('La IA no devolvió un formato válido de análisis.');
    }

    // Forzar consistencia lógica de niveles
    if (jsonResult.score >= 70) jsonResult.level = 'ALTO';
    else if (jsonResult.score >= 40) jsonResult.level = 'MEDIO';
    else jsonResult.level = 'BAJO';

    // Actualizar estadísticas y memoria colectiva
    await updateOnAnalysis(jsonResult);

    return res.status(200).json(jsonResult);
    
  } catch (error) {
    console.error('❌ Error en /api/analyze:', error);
    
    let errorMsg = error.message || 'Error desconocido';
    let statusCode = 500;

    if (errorMsg.includes('413') || errorMsg.toLowerCase().includes('too large')) {
      errorMsg = 'Las imágenes son demasiado pesadas para la IA. Intenta con menos capturas o imágenes más pequeñas.';
      statusCode = 413;
    } else if (errorMsg.includes('429')) {
      errorMsg = 'Límite de velocidad alcanzado (Rate Limit). Espera unos segundos e intenta de nuevo.';
      statusCode = 429;
    }
    
    return res.status(statusCode).json({ 
      error: 'Fallo al procesar el análisis con IA. Verifica logs o intenta de nuevo.',
      details: errorMsg,
      isVisionError: hasImages
    });
  }
});

app.post('/api/report-victim', async (req, res) => {
  const { phone, handle, location } = req.body;
  
  if (!phone && !handle) {
    return res.status(400).json({ error: 'Faltan datos para el reporte' });
  }

  const db = await loadDB();
  db.totalAnalyses = (db.totalAnalyses || 0) + 1;
  db.scamsDetected = (db.scamsDetected || 0) + 1;

  const added = new Set(db.extractedIdentifiers || []);
  if (phone) added.add(phone.replace(/[\s\-()]/g, ''));
  if (handle) added.add(handle.trim());
  db.extractedIdentifiers = Array.from(added);

  const newEntry = {
    id: 'VIC-' + Date.now().toString(36),
    type: '🚨 Reporte de Víctima',
    location: location || "Internacional",
    timestamp: new Date().toISOString()
  };
  db.recentScams = [newEntry, ...(db.recentScams || [])].slice(0, 10);

  await saveDB(db);
  res.json({ success: true });
});

app.get('/api/stats', async (req, res) => {
  const db = await loadDB();
  res.json({
    totalAnalyses: db.totalAnalyses || 0,
    scamsDetected: db.scamsDetected || 0
  });
});

app.get('/api/recent', async (req, res) => {
  const db = await loadDB();
  res.json(db.recentScams || []);
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Robert AI Vision & Memory Backend funcionando' });
});

// ─── SERVIR FRONTEND EN PRODUCCIÓN ───
// Sirve los archivos estáticos construidos por Vite
app.use(express.static(path.join(__dirname, '../dist')));

// Redirige cualquier otra ruta al index.html (para que recargar la página funcione)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

app.listen(port, () => {
  console.log(`🤖 Robert Backend Server running en el puerto ${port}`);
});
