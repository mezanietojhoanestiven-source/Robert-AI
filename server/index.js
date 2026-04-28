import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Groq } from 'groq-sdk';
import rateLimit from 'express-rate-limit';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_PATH = path.join(__dirname, 'scammers.json');

/** Load environment variables */
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ============================================
// SECURITY: Headers
// ============================================
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ============================================
// CORS
// ============================================
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.ALLOWED_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// ============================================
// API Key
// ============================================
if (!process.env.GROQ_API_KEY) {
  console.error('🔴 CRÍTICO: GROQ_API_KEY no está definida');
  process.exit(1);
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ============================================
// Rate Limiting
// ============================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Has superado el límite de peticiones.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/analyze', apiLimiter);

// ============================================
// DATABASE: JSON simple
// ============================================
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
    
    if (result.extractedIdentifiers && result.extractedIdentifiers.length > 0) {
      const added = new Set(db.extractedIdentifiers);
      result.extractedIdentifiers.forEach(id => {
        const normalized = id.includes('@') || id.includes('http') ? id.trim() : id.replace(/[\s\-()]/g, '');
        added.add(normalized);
      });
      db.extractedIdentifiers = Array.from(added);
    }

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

// ============================================
// SANITIZACIÓN
// ============================================
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';
  return input.trim().replace(/[\x00-\x1F\x7F]/g, '').substring(0, 3000);
}

// ============================================
// PROMPT
// ============================================
const getSystemPrompt = (blacklistAlert) => `
Eres "Robert", el agente de inteligencia artificial contra estafas y fraudes cibernéticos. 
Tu misión es analizar mensajes para detectar estafas.

${blacklistAlert}

Reglas:
1. Analiza el mensaje buscando tácticas de urgencia, manipulación, ofertas irreales.
2. Evalúa el riesgo del 0 al 100. (70-100 ALTO, 40-69 MEDIO, 0-39 BAJO)
3. Genera timeline qué pasaría si la víctima cae.
4. Extrae identificadores maliciosos (teléfonos, cuentas, links).
5. Extrae "red flags" (banderas rojas).

IMPORTANTE: DEBES DEVOLVER EXCLUSIVAMENTE JSON.
{
  "reasoning": "...",
  "score": 0-100,
  "level": "ALTO/MEDIO/BAJO",
  "scamType": "...",
  "indicators": [{ "icon": "❌", "title": "...", "description": "..." }],
  "timeline": [{ "day": "...", "title": "...", "description": "...", "color": "red" }],
  "explanations": [{ "icon": "🔍", "title": "...", "description": "..." }],
  "flaggedWords": [],
  "extractedIdentifiers": [],
  "osint_location": "..."
}
`;

// ============================================
// API: /api/analyze
// ============================================
app.post('/api/analyze', async (req, res) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  console.log(`[${requestId}] Análisis iniciado`);
  
  const { message } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Debes proporcionar texto para analizar' });
  }

  const safeMessage = sanitizeInput(message);

  // Verificar blacklist
  const blacklist = await getBlacklist();
  let matchFound = false;
  let matchingIdentifier = '';
  
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
  
  const modelToUse = 'llama-3.3-70b-versatile';
  
  const systemPrompt = getSystemPrompt(matchFound ? `OJO: "${matchingIdentifier}" YA ESTÁ EN LA LISTA NEGRA.` : '');
  
  const messagesPayload = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `Analiza: ${safeMessage}` }
  ];

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: messagesPayload,
      model: modelToUse,
      temperature: 0, 
      max_tokens: 3000,
      response_format: { type: "json_object" }
    });

    const aiResponseContent = chatCompletion.choices[0]?.message?.content || "{}";

    let jsonResult;
    try {
      jsonResult = JSON.parse(aiResponseContent);
    } catch (e) {
      console.error(`[${requestId}] Error parseando:`, e.message);
      throw new Error('La IA devolvió formato inválido.');
    }

    jsonResult.score = parseInt(jsonResult.score ?? 0) || 0;
    jsonResult.scamType = jsonResult.scamType || "Análisis General";
    jsonResult.indicators = (jsonResult.indicators || []).map(ind => ({
      icon: ind.icon || "���️",
      title: ind.title || "Alerta",
      description: ind.description || ""
    }));
    jsonResult.timeline = (jsonResult.timeline || []).map(item => ({
      day: item.day || "Evento",
      title: item.title || "Suceso",
      description: item.description || "",
      color: item.color || "red"
    }));
    jsonResult.explanations = (jsonResult.explanations || []).map(exp => ({
      icon: exp.icon || "🔍",
      title: exp.title || "Detalle",
      description: exp.description || ""
    }));
    jsonResult.flaggedWords = jsonResult.flaggedWords || [];
    jsonResult.extractedIdentifiers = jsonResult.extractedIdentifiers || [];
    jsonResult.osint_location = jsonResult.osint_location || "Internacional";
    jsonResult.reasoning = jsonResult.reasoning || "Análisis procesado.";

    if (jsonResult.score >= 70) jsonResult.level = 'ALTO';
    else if (jsonResult.score >= 40) jsonResult.level = 'MEDIO';
    else jsonResult.level = 'BAJO';

    await updateOnAnalysis(jsonResult);
    
    console.log(`[${requestId}] Completado: score=${jsonResult.score}, level=${jsonResult.level}`);
    return res.status(200).json(jsonResult);
    
  } catch (error) {
    console.error(`[${requestId}] Error:`, error.message);
    return res.status(500).json({ error: 'Fallo al analizar.', details: error.message });
  }
});

// ============================================
// API: /api/report-victim
// ============================================
app.post('/api/report-victim', async (req, res) => {
  const { phone, handle, location } = req.body;
  
  if (!phone && !handle) {
    return res.status(400).json({ error: 'Faltan datos' });
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

// ============================================
// API: /api/stats
// ============================================
app.get('/api/stats', async (req, res) => {
  const db = await loadDB();
  res.json({ totalAnalyses: db.totalAnalyses || 0, scamsDetected: db.scamsDetected || 0 });
});

// ============================================
// API: /api/recent
// ============================================
app.get('/api/recent', async (req, res) => {
  const db = await loadDB();
  res.json(db.recentScams || []);
});

// ============================================
// API: /api/status
// ============================================
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok' });
});

// ============================================
// STATIC FILES
// ============================================
app.use(express.static(path.join(__dirname, '../dist')));

// Fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ============================================
// SERVER
// ============================================
app.listen(port, () => {
  console.log(`🤖 Robert Backend Server running en puerto ${port}`);
});