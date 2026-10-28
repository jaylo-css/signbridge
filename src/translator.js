// Step 5 of the pipeline: sign gloss → one natural English sentence with Gemini.
// Never throws: on any problem it returns a basic fallback sentence plus a warning.
import { GoogleGenAI } from '@google/genai';
import { MODEL_NAME, TRANSLATE_TIMEOUT_MS } from './config.js';

const SYSTEM_INSTRUCTION =
  "You are a sign language interpreter. You receive sign language gloss: an ordered list of signed words in sign-language word order with no grammar words. Convert it into ONE short, natural, grammatical English sentence that a fluent interpreter would say. Add only the small words needed for grammar (articles, verb forms, 'to', 'is', etc.). Do not add new ideas. Output only the sentence, with no quotes or explanation.";

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
const hasKey = Boolean(apiKey) && apiKey !== 'your-api-key-here';

let ai = null;
try {
  if (hasKey) ai = new GoogleGenAI({ apiKey });
} catch (err) {
  console.warn('Could not create the Gemini client.', err);
}

// "ME WANT WATER" → "Me want water."
export function fallbackSentence(words) {
  const text = words.join(' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Gemini request timed out')), ms)),
  ]);
}

// Returns { sentence, warning } where warning is null on success.
export async function translateGloss(words) {
  if (!ai) {
    return {
      sentence: fallbackSentence(words),
      warning: 'No Gemini API key found. Showing a basic translation.',
    };
  }

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: words.join(' '),
        config: { systemInstruction: SYSTEM_INSTRUCTION },
      }),
      TRANSLATE_TIMEOUT_MS
    );
    const sentence = (response.text || '').trim().replace(/^["'“]+|["'”]+$/g, '');
    if (!sentence) throw new Error('Gemini returned an empty response');
    return { sentence, warning: null };
  } catch (err) {
    console.warn('Gemini translation failed, using fallback.', err);
    return {
      sentence: fallbackSentence(words),
      warning: 'Gemini request failed. Showing a basic translation.',
    };
  }
}
