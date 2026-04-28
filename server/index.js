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

/** Load environment variables */
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// ============================================
// SECURITY: API Key encriptada y validación de dominio
// ============================================

// Función para encriptar la API Key (para ambientes production)
function getEncryptedApiKey() {
  const rawKey = process.env.GROQ_API_KEY;
  if (!rawKey) return null;
  
  // Si la clave ya está encriptada (comienza con enc:), desencriptar
  if (rawKey.startsWith('enc:')) {
    const encrypted = Buffer.from(rawKey.substring(4), 'base64');
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'utf8');
    const iv = encrypted.slice(0, 16);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    return decipher.update(encrypted.slice(16)).toString() + decipher.final();
  }
  
  return rawKey;
}

// Validar que la solicitud venga de dominios autorizados
const ALLOWED_DOMAINS = [
  'robert-detector-estafas.onrender.com',
  'localhost',
  '127.0.0.1'
];

function validateRequestOrigin(req) {
  const origin = req.headers.origin || req.headers.referer || '';
  const hostname = req.hostname || '';
  
  // En desarrollo, permitir todo
  if (process.env.NODE_ENV !== 'production') {
    return true;
  }
  
  return ALLOWED_DOMAINS.some(domain => 
    hostname.includes(domain) || origin.includes(domain)
  );
}

// ============================================
// SECURITY: Verificación de API Key al iniciar
// ============================================
function checkApiKeySafety() {
  const key = process.env.GROQ_API_KEY;
  if (!key) {
    console.error('🔴 CRÍTICO: GROQ_API_KEY no está definida en .env');
    process.exit(1);
  }
  
  // Verificar que no sea una key de ejemplo
  if (key.includes('example') || key.length < 20) {
    console.error('🔴 CRÍTICO: API Key inválida o de ejemplo');
    process.exit(1);
  }
  
  console.log('✅ API Key validada correctamente');
}

checkApiKeySafety();

// Inicializar Groq con la API Key validada
const groq = new Groq({ apiKey: getEncryptedApiKey() });

// ============================================
// SECURITY: Headers de seguridad HTTP
// ============================================
app.use((req, res, next) => {
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "img-src 'self' data: https:; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "connect-src 'self' https://api.groq.com https://*.groq.com;"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// ============================================
// SECURITY: CORS configurado con validación
// ============================================
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.ALLOWED_ORIGIN
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir solicitudes sin origin (como Postman/curl)
    if (!origin) {
      return callback(null, true);
    }
    
    if (!validateRequestOrigin(req)) {
      return callback(new Error('Dominio no autorizado'));
    }
    
    if (allowedOrigins.includes(origin) || origin.includes('localhost')) {
      callback(null, true);
    } else {
      callback(new Error('Origen no permitido por CORS'));
    }
  },
  credentials: true
}));

// Aumentamos a 50mb para soportar arrays de imágenes en base64
app.use(express.json({ limit: '50mb', verify: (req, res, buf) => {
  // Validar tamaño máximo (20MB)
  const maxSize = 20 * 1024 * 1024;
  if (buf.length > maxSize) {
    throw new Error('Payload demasiado grande. Maximum 20MB permitted.');
  }
}}));

// ============================================
// SECURITY: Rate limiting
// ============================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Has superado el límite de peticiones.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.connection.remoteAddress || 'unknown'
});
app.use('/api/analyze', apiLimiter);

// ============================================
// LOGGING: Sistema de logs
// ============================================
const LOG_FILE = path.join(__dirname, 'server.log');

async function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, ...(data && { data }) };
  const logLine = JSON.stringify(logEntry) + '\n';
  
  try {
    await fs.appendFile(LOG_FILE, logLine);
  } catch (e) {
    console.error('Error writing log:', e);
  }
  
  if (level === 'ERROR') console.error(`[${timestamp}] ${message}`, data || '');
  else if (level === 'WARN') console.warn(`[${timestamp}] ${message}`, data || '');
  else console.log(`[${timestamp}] ${message}`, data || '');
}

// ============================================
// DATABASE: SQLite
// ============================================
import Database from 'better-sqlite3';

const DB_PATH = path.join(__dirname, 'robert.db');
let db;

function initDatabase() {
  try {
    db = new Database(DB_PATH);
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        message_preview TEXT,
        score INTEGER,
        level TEXT,
        scam_type TEXT
      );
      
      CREATE TABLE IF NOT EXISTS blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT UNIQUE NOT NULL,
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        source TEXT DEFAULT 'auto'
      );
      
      CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY,
        total_analyses INTEGER DEFAULT 0,
        scams_detected INTEGER DEFAULT 0,
        last_updated TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_blacklist_identifier ON blacklist(identifier);
      CREATE INDEX IF NOT EXISTS idx_analyses_timestamp ON analyses(timestamp);
    `);
    
    log('INFO', 'Base de datos SQLite inicializada');
  } catch (e) {
    log('ERROR', 'Error inicializando base de datos', { error: e.message });
    process.exit(1);
  }
}

initDatabase();

// ============================================
// DATABASE: Funciones con prepared statements
// ============================================
function getBlacklist() {
  const stmt = db.prepare('SELECT identifier FROM blacklist');
  return stmt.all().map(row => row.identifier);
}

function addToBlacklist(identifiers) {
  const stmt = db.prepare('INSERT OR IGNORE INTO blacklist (identifier) VALUES (?)');
  const insertMany = db.transaction((ids) => {
    for (const id of ids) {
      stmt.run(id);
    }
  });
  insertMany(identifiers);
}

function updateStats(scamsDetected = false) {
  const stmt = db.prepare(`UPDATE stats SET total_analyses = total_analyses + 1, scams_detected = scams_detected + ?, last_updated = datetime('now') WHERE id = 1`);
  stmt.run(scamsDetected ? 1 : 0);
}

function getStats() {
  const stmt = db.prepare('SELECT total_analyses, scams_detected FROM stats WHERE id = 1');
  const row = stmt.get();
  return row || { total_analyses: 0, scams_detected: 0 };
}

function recordAnalysis(score, level, scamType, flaggedIdentifiers = []) {
  const stmt = db.prepare('INSERT INTO analyses (score, level, scam_type) VALUES (?, ?, ?)');
  stmt.run(score, level, scamType);
  
  if (flaggedIdentifiers.length > 0) {
    addToBlacklist(flaggedIdentifiers);
  }
  
  updateStats(level === 'ALTO');
}

// ============================================
// SECURITY: Sanitización de输入
// ============================================
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';
  
  return input.trim().replace(/[\x00-\x1F\x7F]/g, '').substring(0, 3000);
}

// Esta función ya no se usa - el OCR se hace en el frontend
// function validateImageBase64(imgBase64) {

// ============================================
// PROMPT: Sistema de análisis Robert
// ============================================
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

7. Rastreo OSINT: Analiza los números de teléfono extraídos. Determina el país y, si es posible, la ciudad o región de origen usando el código indicativo internacional (ej. +57 = Colombia, +234 = Nigeria, +52 = México). Retorna estos datos en "osint_location" (string vacío si hay número).

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

Nota: Los campos "icon" DEBEN ser un EMOJI. "level" solo puede ser "ALTO", "MEDIO" o "BAJO". "color" de timeline: "green", "yellow", "red", "dark-red". Solo devuelve el JSON, NUNCA text markdown. Si es seguro, nivel BAJO, score bajo, y extractedIdentifiers vacío.
`;

// ============================================
// API: Endpoint de análisis principal
// ============================================
app.post('/api/analyze', async (req, res) => {
  
  // Para imágenes, usamos texto extraído por OCR + análisis de texto
  // Esto es más confiable que modelos de visión API
  const modelToUse = 'llama-3.3-70b-versatile';
  
  const systemPrompt = getSystemPrompt(matchFound ? `OJO: EL IDENTIFICADOR "${matchingIdentifier}" YA ESTÁ EN LA LISTA NEGRA. ESTO ES UNA ESTAFA CONFIRMADA.` : '');
  
  const messagesPayload = [];

  if (!hasImages) {
    messagesPayload.push({ role: 'system', content: systemPrompt });
  }

  const userContent = [];
  
  if (hasImages) {
    userContent.push({ 
      type: 'text', 
      text: "INSTRUCCIONES DE SISTEMA:\n" + systemPrompt + "\n\nMENSAJE DEL USUARIO A ANALIZAR:\n" 
    });
  }

  let textPrompt = "Analiza el siguiente contenido proporcionado. ";
  textPrompt += "Busca patrones de fraude, manipulación o estafa. DEBES RESPONDER SOLO EN FORMATO JSON.\n\nContenido: ";
  textPrompt += safeMessage || "[Sin texto para analizar]";
  
  userContent.push({ type: 'text', text: textPrompt });

  // NO se envían imágenes - el OCR se hace en el frontend

  const jsonHint = `\n\nResponde EXCLUSIVAMENTE con el objeto JSON siguiendo esta estructura:
  {
    "reasoning": "...",
    "score": 0-100,
    "level": "ALTO/MEDIO/BAJO",
    "scamType": "...",
    "indicators": [],
    "timeline": [],
    "explanations": [],
    "flaggedWords": [],
    "extractedIdentifiers": [],
    "osint_location": "..."
  }`;
  
  userContent.push({ type: 'text', text: jsonHint });
  messagesPayload.push({ role: 'user', content: userContent });

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
    } catch (parseError) {
      log('ERROR', 'Error parseando respuesta de IA', { requestId, error: parseError.message });
      throw new Error('La IA devolvió un formato de texto no válido.');
    }

    const score = jsonResult.score ?? jsonResult.puntaje ?? jsonResult.risk_score ?? 0;
    const scamType = jsonResult.scamType || jsonResult.tipo_estafa || "Análisis General";
    
    jsonResult.score = parseInt(score) || 0;
    jsonResult.scamType = scamType;

    jsonResult.indicators = (jsonResult.indicators || []).map(ind => ({
      icon: ind.icon || "⚠️",
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
    jsonResult.reasoning = jsonResult.reasoning || "Análisis procesado correctamente.";

    if (jsonResult.score >= 70) jsonResult.level = 'ALTO';
    else if (jsonResult.score >= 40) jsonResult.level = 'MEDIO';
    else jsonResult.level = 'BAJO';

    recordAnalysis(jsonResult.score, jsonResult.level, jsonResult.scamType, jsonResult.extractedIdentifiers);
    
    const duration = Date.now() - startTime;
    log('INFO', 'Análisis completado', { requestId, score: jsonResult.score, level: jsonResult.level, duration });

    return res.status(200).json(jsonResult);
    
  } catch (error) {
    log('ERROR', 'Error en análisis', { requestId, error: error.message });
    
    let errorMsg = error.message || 'Error desconocido';
    let statusCode = 500;

    if (errorMsg.includes('413') || errorMsg.toLowerCase().includes('too large')) {
      errorMsg = 'Las imágenes son demasiado pesadas para la IA.';
      statusCode = 413;
    } else if (errorMsg.includes('429')) {
      errorMsg = 'Límite de velocidad alcanzado.';
      statusCode = 429;
    }
    
    return res.status(statusCode).json({ 
      error: 'Fallo al procesar el análisis con IA.',
      details: errorMsg
    });
  }
});

// ============================================
// API: Reporte de víctima
// ============================================
app.post('/api/report-victim', async (req, res) => {
  const { phone, handle, location } = req.body;
  
  if (!phone && !handle) {
    return res.status(400).json({ error: 'Faltan datos para el reporte' });
  }

  const identifiers = [];
  if (phone) identifiers.push(phone.replace(/[\s\-()]/g, ''));
  if (handle) identifiers.push(handle.trim());
  
  addToBlacklist(identifiers);
  updateStats(true);
  
  log('INFO', 'Reporte de víctima registrado', { phone, handle });
  
  res.json({ success: true });
});

// ============================================
// API: Estadísticas
// ============================================
app.get('/api/stats', (req, res) => {
  const stats = getStats();
  res.json(stats);
});

// ============================================
// API: Estado del servidor
// ============================================
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// PÁGINAS ESTÁTICAS
// ============================================
app.get('/ads.txt', (req, res) => res.sendFile(path.join(__dirname, '../dist/ads.txt')));
app.get('/robots.txt', (req, res) => res.sendFile(path.join(__dirname, '../dist/robots.txt')));
app.get('/sitemap.xml', (req, res) => res.sendFile(path.join(__dirname, '../dist/sitemap.xml')));

app.get('/how-it-works', (req, res) => res.sendFile(path.join(__dirname, '../dist/how-it-works.html')));
app.get('/faq', (req, res) => res.sendFile(path.join(__dirname, '../dist/faq.html')));
app.get('/about', (req, res) => res.sendFile(path.join(__dirname, '../dist/about.html')));
app.get('/privacy-policy', (req, res) => res.sendFile(path.join(__dirname, '../dist/privacy.html')));
app.get('/terms', (req, res) => res.sendFile(path.join(__dirname, '../dist/terms.html')));
app.get('/cookies', (req, res) => res.sendFile(path.join(__dirname, '../dist/cookies.html')));

// STATIC: Archivos del frontend
app.use(express.static(path.join(__dirname, '../dist')));

// SPA Fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ============================================
// SERVER: Iniciar servidor
// ============================================
app.listen(port, () => {
  log('INFO', `🤖 Robert Backend Server running en el puerto ${port}`);
});

process.on('SIGTERM', () => {
  log('INFO', 'Servidor cerrando...');
  if (db) db.close();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', 'Unhandled Rejection', { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
  log('ERROR', 'Uncaught Exception', { error: error.message });
  process.exit(1);
});
}));

// ============================================
// SECURITY: Aumentamos a 50mb para soportar arrays de imágenes en base64
// ============================================
app.use(express.json({ limit: '50mb', verify: (req, res, buf) => {
  // Validar tamaño máximo (20MB)
  const maxSize = 20 * 1024 * 1024;
  if (buf.length > maxSize) {
    throw new Error('Payload demasiado grande. Máximo 20MB permitted.');
  }
}}));

// ============================================
// SECURITY: Validar API Key al iniciar
// ============================================
if (!process.env.GROQ_API_KEY) {
  console.error('🔴 CRÍTICO: GROQ_API_KEY no está definida en .env');
  process.exit(1);
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ============================================
// SECURITY: Rate limiting configurado
// ============================================
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Has superado el límite de peticiones. Por favor, inténtalo de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  }
});
app.use('/api/analyze', apiLimiter);

// ============================================
// LOGGING: Sistema de logs integrado
// ============================================
const LOG_FILE = path.join(__dirname, 'server.log');

async function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...(data && { data })
  };
  
  const logLine = JSON.stringify(logEntry) + '\n';
  
  try {
    await fs.appendFile(LOG_FILE, logLine);
  } catch (e) {
    console.error('Error writing log:', e);
  }
  
  switch (level) {
    case 'ERROR': console.error(`[${timestamp}] ${message}`, data || '');
    case 'WARN': console.warn(`[${timestamp}] ${message}`, data || '');
    default: console.log(`[${timestamp}] ${message}`, data || '');
  }
}

// ============================================
// DATABASE: SQLite con mejor-sqlite3 (sincrónico para mayor seguridad)
// ============================================
import Database from 'better-sqlite3';

const DB_PATH = path.join(__dirname, 'robert.db');
let db;

function initDatabase() {
  try {
    db = new Database(DB_PATH);
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS analyses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        message_preview TEXT,
        score INTEGER,
        level TEXT,
        scam_type TEXT
      );
      
      CREATE TABLE IF NOT EXISTS blacklist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        identifier TEXT UNIQUE NOT NULL,
        added_at TEXT NOT NULL DEFAULT (datetime('now')),
        source TEXT DEFAULT 'auto'
      );
      
      CREATE TABLE IF NOT EXISTS stats (
        id INTEGER PRIMARY KEY,
        total_analyses INTEGER DEFAULT 0,
        scams_detected INTEGER DEFAULT 0,
        last_updated TEXT NOT NULL DEFAULT (datetime('now'))
      );
      
      CREATE INDEX IF NOT EXISTS idx_blacklist_identifier ON blacklist(identifier);
      CREATE INDEX IF NOT EXISTS idx_analyses_timestamp ON analyses(timestamp);
    `);
    
    log('INFO', 'Base de datos SQLite inicializada');
  } catch (e) {
    log('ERROR', 'Error inicializando base de datos', { error: e.message });
    process.exit(1);
  }
}

initDatabase();

// ============================================
// SECURITY: Funciones de base de datos con prepared statements
// ============================================
function getBlacklist() {
  const stmt = db.prepare('SELECT identifier FROM blacklist');
  return stmt.all().map(row => row.identifier);
}

function addToBlacklist(identifiers) {
  const stmt = db.prepare('INSERT OR IGNORE INTO blacklist (identifier) VALUES (?)');
  const insertMany = db.transaction((ids) => {
    for (const id of ids) {
      stmt.run(id);
    }
  });
  insertMany(identifiers);
}

function updateStats(scamsDetected = false) {
  const stmt = db.prepare(`
    UPDATE stats SET 
      total_analyses = total_analyses + 1,
      scams_detected = scams_detected + ?,
      last_updated = datetime('now')
    WHERE id = 1
  `);
  stmt.run(scamsDetected ? 1 : 0);
}

function getStats() {
  const stmt = db.prepare('SELECT total_analyses, scams_detected FROM stats WHERE id = 1');
  const row = stmt.get();
  return row || { total_analyses: 0, scams_detected: 0 };
}

function recordAnalysis(score, level, scamType, flaggedIdentifiers = []) {
  const stmt = db.prepare(`
    INSERT INTO analyses (score, level, scam_type) VALUES (?, ?, ?)
  `);
  stmt.run(score, level, scamType);
  
  if (flaggedIdentifiers.length > 0) {
    addToBlacklist(flaggedIdentifiers);
  }
  
  updateStats(level === 'ALTO');
}

// ============================================
// SECURITY: Sanitización de输入
// ============================================
function sanitizeInput(input) {
  if (!input || typeof input !== 'string') return '';
  
  return input
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '')
    .substring(0, 3000);
}

// ============================================
// PROMPT: Sistema de análisis Robert
// ============================================
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

7. Rastreo OSINT: Analiza los números de teléfono extraídos. Determina el país y, si es posible, la ciudad o región de origen usando el código indicativo internacional (ej. +57 = Colombia, +234 = Nigeria, +52 = México). Retorna estos datos en "osint_location" (string vacío si hay número).

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

Nota: Los campos "icon" DEBEN ser un EMOJI. "level" solo puede ser "ALTO", "MEDIO" o "BAJO". "color" de timeline: "green", "yellow", "red", "dark-red". Solo devuelve el JSON, NUNCA text markdown. Si es seguro, nivel BAJO, score bajo, y extractedIdentifiers vacío.
`;

// ============================================
// API: Endpoint de análisis principal
// ============================================
app.post('/api/analyze', async (req, res) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID().substring(0, 8);
  
  log('INFO', `Análisis iniciado`, { requestId });
  
  const { message } = req.body;

  // Solo accept texto - OCR se hace en el frontend
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Debes enviar texto para analizar' });
  }

  const safeMessage = sanitizeInput(message);

  // Verificar blacklist local
  const blacklist = getBlacklist();
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
  
  // Siempre usamos texto - no imágenes
  const modelToUse = 'llama-3.3-70b-versatile';
  
  const systemPrompt = getSystemPrompt(matchFound ? `OJO: EL IDENTIFICADOR "${matchingIdentifier}" YA ESTÁ EN LA LISTA NEGRA. ESTO ES UNA ESTAFA CONFIRMADA.` : '');
  
  const messagesPayload = [];

  if (!hasImages) {
    messagesPayload.push({ role: 'system', content: systemPrompt });
  }

  const userContent = [];
  
  if (hasImages) {
    userContent.push({ 
      type: 'text', 
      text: "INSTRUCCIONES DE SISTEMA:\n" + systemPrompt + "\n\nMENSAJE DEL USUARIO A ANALIZAR:\n" 
    });
  }

  let textPrompt = "Analiza el siguiente contenido proporcionado. ";
  textPrompt += "Busca patrones de fraude, manipulación o estafa. DEBES RESPONDER SOLO EN FORMATO JSON.\n\nContenido: ";
  textPrompt += safeMessage || "[Sin texto para analizar]";
  
  userContent.push({ type: 'text', text: textPrompt });

  // IMÁGENES: Ya no se envían - OCR local extrae el texto antes
  // El backend solo recibe el texto extraído por OCR

  const jsonHint = `\n\nResponde EXCLUSIVAMENTE con el objeto JSON siguiendo esta estructura:
  {
    "reasoning": "...",
    "score": 0-100,
    "level": "ALTO/MEDIO/BAJO",
    "scamType": "...",
    "indicators": [],
    "timeline": [],
    "explanations": [],
    "flaggedWords": [],
    "extractedIdentifiers": [],
    "osint_location": "..."
  }`;
  
  userContent.push({ type: 'text', text: jsonHint });
  messagesPayload.push({ role: 'user', content: userContent });

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
    } catch (parseError) {
      log('ERROR', 'Error parseando respuesta de IA', { requestId, error: parseError.message });
      throw new Error('La IA devolvió un formato de texto no válido.');
    }

    const score = jsonResult.score ?? jsonResult.puntaje ?? jsonResult.risk_score ?? 0;
    const scamType = jsonResult.scamType || jsonResult.tipo_estafa || "Análisis General";
    
    jsonResult.score = parseInt(score) || 0;
    jsonResult.scamType = scamType;

    jsonResult.indicators = (jsonResult.indicators || []).map(ind => ({
      icon: ind.icon || "⚠️",
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
    jsonResult.reasoning = jsonResult.reasoning || "Análisis procesado correctamente.";

    if (jsonResult.score >= 70) jsonResult.level = 'ALTO';
    else if (jsonResult.score >= 40) jsonResult.level = 'MEDIO';
    else jsonResult.level = 'BAJO';

    recordAnalysis(jsonResult.score, jsonResult.level, jsonResult.scamType, jsonResult.extractedIdentifiers);
    
    const duration = Date.now() - startTime;
    log('INFO', `Análisis completado`, { requestId, score: jsonResult.score, level: jsonResult.level, duration });

    return res.status(200).json(jsonResult);
    
  } catch (error) {
    log('ERROR', 'Error en análisis', { requestId, error: error.message });
    
    let errorMsg = error.message || 'Error desconocido';
    let statusCode = 500;

    if (errorMsg.includes('413') || errorMsg.toLowerCase().includes('too large')) {
      errorMsg = 'Las imágenes son demasiado pesadas para la IA.';
      statusCode = 413;
    } else if (errorMsg.includes('429')) {
      errorMsg = 'Límite de velocidad alcanzado.';
      statusCode = 429;
    }
    
    return res.status(statusCode).json({ 
      error: 'Fallo al procesar el análisis con IA.',
      details: errorMsg
    });
  }
});

// ============================================
// API: Reporte de víctima
// ============================================
app.post('/api/report-victim', async (req, res) => {
  const { phone, handle, location } = req.body;
  
  if (!phone && !handle) {
    return res.status(400).json({ error: 'Faltan datos para el reporte' });
  }

  const identifiers = [];
  if (phone) identifiers.push(phone.replace(/[\s\-()]/g, ''));
  if (handle) identifiers.push(handle.trim());
  
  addToBlacklist(identifiers);
  updateStats(true);
  
  log('INFO', 'Reporte de víctima registrado', { phone, handle });
  
  res.json({ success: true });
});

// ============================================
// API: Estadísticas
// ============================================
app.get('/api/stats', (req, res) => {
  const stats = getStats();
  res.json(stats);
});

// ============================================
// API: Estado del servidor
// ============================================
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// PÁGINAS ESTÁTICAS
// ============================================
app.get('/ads.txt', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/ads.txt'));
});
app.get('/robots.txt', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/robots.txt'));
});
app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/sitemap.xml'));
});

// Páginas de información
app.get('/how-it-works', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/how-it-works.html'));
});
app.get('/faq', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/faq.html'));
});
app.get('/about', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/about.html'));
});
app.get('/privacy-policy', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/privacy.html'));
});
app.get('/terms', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/terms.html'));
});
app.get('/cookies', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/cookies.html'));
});

// ============================================
// STATIC: Archivos del frontend
// ============================================
app.use(express.static(path.join(__dirname, '../dist')));

// SPA Fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// ============================================
// SERVER: Iniciar servidor
// ============================================
app.listen(port, () => {
  log('INFO', `🤖 Robert Backend Server running en el puerto ${port}`);
});

process.on('SIGTERM', () => {
  log('INFO', 'Servidor cerrando...');
  if (db) db.close();
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  log('ERROR', 'Unhandled Rejection', { reason: String(reason) });
});

process.on('uncaughtException', (error) => {
  log('ERROR', 'Uncaught Exception', { error: error.message });
  process.exit(1);
});