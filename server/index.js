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

async function initDB() {
  try { await fs.access(DB_PATH); } 
  catch { await fs.writeFile(DB_PATH, JSON.stringify({ extractedIdentifiers: [] })); }
}
initDB();

async function getBlacklist() {
  try {
    const data = await fs.readFile(DB_PATH, 'utf-8');
    return JSON.parse(data).extractedIdentifiers || [];
  } catch { return []; }
}

async function addToBlacklist(identifiers) {
  if (!identifiers || identifiers.length === 0) return;
  const current = await getBlacklist();
  const added = new Set(current);
  identifiers.forEach(id => added.add(id));
  await fs.writeFile(DB_PATH, JSON.stringify({ extractedIdentifiers: Array.from(added) }));
}

const getSystemPrompt = (blacklistStr) => `
Eres "Robert", el agente de inteligencia artificial visual definitivo contra estafas y fraudes cibernéticos. 
Tu misión es cazar estafadores analizando capturas de pantalla o textos. Posees un conocimiento profundo de psicología humana, manipulación emocional, y todas las técnicas de fraude.

BASE DE DATOS DE ESTAFADORES YA REPORTADOS:
[${blacklistStr}]
Si ves algun usuario, correo o teléfono que coincide o se parece a los datos de esta lista negra en las imágenes/texto, levanta ALERTA MÁXIMA ROJA inmediatamente.

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

  // Leer memoria colectiva
  const blacklist = await getBlacklist();
  const blacklistStr = blacklist.join(', ');

  const messagesPayload = [
    { role: 'system', content: getSystemPrompt(blacklistStr) }
  ];

  // Preparar contenido de texto
  let userContent = "Analiza este texto extraído de capturas o provisto por el usuario: \n";
  if (safeMessage) {
    userContent += safeMessage;
  } else {
    userContent += "[No text provided]";
  }

  messagesPayload.push({ role: 'user', content: userContent });

  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: messagesPayload,
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1, 
      max_tokens: 3000,
      response_format: { type: "json_object" }
    });

    const aiResponseContent = chatCompletion.choices[0]?.message?.content;
    if (!aiResponseContent) throw new Error('Respuesta vacía desde Groq');

    const jsonResult = JSON.parse(aiResponseContent);

    // Validación básica
    if (jsonResult.score === undefined || !jsonResult.scamType) {
      throw new Error('Formato JSON de Groq no válido');
    }

    // Forzar consistencia lógica: si la IA se equivoca, la corregimos
    if (jsonResult.score >= 70) {
      jsonResult.level = 'ALTO';
    } else if (jsonResult.score >= 40) {
      jsonResult.level = 'MEDIO';
    } else {
      jsonResult.level = 'BAJO';
    }

    // MEMORIA COLECTIVA: Si es muy riesgoso guardar los identificadores en la DB
    if (jsonResult.level === 'ALTO' && jsonResult.extractedIdentifiers?.length > 0) {
      await addToBlacklist(jsonResult.extractedIdentifiers);
    }

    return res.status(200).json(jsonResult);
    
  } catch (error) {
    console.error('Error al comunicarse con Groq:', error);
    return res.status(500).json({ 
      error: 'Fallo al procesar el análisis visual con IA. Verifica logs.',
      details: error.message
    });
  }
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
