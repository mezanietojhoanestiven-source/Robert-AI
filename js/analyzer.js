/**
 * Envía la información al backend para que sea analizada por la Inteligencia Artificial (Groq Vision/Texto).
 * La IA devolverá un objeto JSON estructurado con el resultado.
 * 
 * @param {Object} payload - Contiene el texto y/o imágenes base64 a analizar { message, images }.
 * @returns {Promise<Object>} - El resultado del análisis en formato JSON.
 */
export async function analyzeData(payload) {
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      const msg = errorData.error || 'Error al comunicarse con el servidor de análisis';
      const details = errorData.details ? ` (${errorData.details})` : '';
      throw new Error(msg + details);
    }

    const data = await response.json();
    
    // Adjuntar el texto original para que la interfaz lo use
    data.originalText = payload.message || "Capturas de pantalla analizadas visualmente.";
    
    // Asegurarse de que flaggedWords exista como array si la IA lo olvidó
    if (!data.flaggedWords || !Array.isArray(data.flaggedWords)) {
      data.flaggedWords = [];
    }

    return data;

  } catch (error) {
    console.error('Error in analyzeData:', error);
    
    if (error.message.includes('Failed to fetch')) {
      throw new Error('No se pudo contactar con el servidor. Verifica tu conexión o intenta reiniciar.');
    }
    throw new Error(error.message || 'Error desconocido al analizar.');
  }
}

