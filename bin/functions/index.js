/**
 * Firebase Cloud Function that proxies requests to the Hugging Face Inference API
 * for the HuggingFaceH4/zephyr-7b-beta model. Keeping the call server-side prevents
 * exposing the Hugging Face API key in client-side code.
 */
const functions = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');

if (!admin.apps.length) {
  admin.initializeApp();
}

const MODEL_ID = 'HuggingFaceH4/zephyr-7b-beta';

/**
 * Shared helper to build a properly formatted prompt from the conversation history.
 * @param {Array<{sender: string, text: string}>} history
 * @returns {string}
 */
function buildPrompt(history) {
  const systemInstruction =
    'You are TASH, the helpful virtual assistant for NAME IT SCENTS. ' +
    'Give concise answers that help customers learn about perfumes, products, and orders.';

  const conversation = history
    .map((item) => {
      const role = item.sender === 'bot' ? 'assistant' : 'user';
      return `${role.toUpperCase()}: ${item.text}`;
    })
    .join('\n');

  return `${systemInstruction}\n${conversation}\nASSISTANT:`;
}

exports.generateChatResponse = functions
  .region('us-central1')
  .https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' });
      return;
    }

    const huggingFaceKey = functions.config().huggingface?.key;

    if (!huggingFaceKey) {
      res.status(500).json({ error: 'Hugging Face API key is not configured.' });
      return;
    }

    const { history } = req.body || {};

    if (!Array.isArray(history) || history.length === 0) {
      res.status(400).json({ error: 'Request body must include a non-empty history array.' });
      return;
    }

    const trimmedHistory = history.slice(-10);
    const prompt = buildPrompt(trimmedHistory);

    try {
      const response = await fetch(`https://api-inference.huggingface.co/models/${MODEL_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${huggingFaceKey}`,
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: 256,
            temperature: 0.7,
            top_p: 0.9,
            repetition_penalty: 1.05,
          },
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        functions.logger.error('Hugging Face API error', {
          status: response.status,
          body: errorPayload,
        });

        res.status(502).json({
          error: 'Hugging Face API call failed.',
          details: errorPayload,
        });
        return;
      }

      const data = await response.json();
      const generatedText = Array.isArray(data) && data[0]?.generated_text
        ? data[0].generated_text
        : data?.generated_text;

      if (!generatedText) {
        functions.logger.error('Unexpected Hugging Face response structure', { data });
        res.status(502).json({
          error: 'Unexpected response from Hugging Face API.',
        });
        return;
      }

      const assistantReply = generatedText.split('ASSISTANT:').pop().trim();

      res.status(200).json({ reply: assistantReply });
    } catch (error) {
      functions.logger.error('Error calling Hugging Face API', error);
      res.status(500).json({ error: 'Failed to generate response.' });
    }
  });



