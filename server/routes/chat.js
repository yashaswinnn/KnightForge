require('dotenv').config();
const express = require('express');

const router = express.Router();

const SYSTEM_PROMPT = `You are a witty AI chess opponent in KnightForge.
React to chess moves with short clever 1-2 sentence comments.
Be confident, slightly dramatic, occasionally funny.
Never suggest moves. Stay in character.`;

function buildFallbackMessage(prompt) {
  const lower = prompt.toLowerCase();
  const moveMatch = prompt.match(/\b([a-h][1-8][a-h][1-8][qrbn]?)\b/i);
  const move = moveMatch ? moveMatch[1] : null;

  if (lower.includes('player says:')) {
    const replies = [
      'Bold words. Let us see whether your pieces can support them.',
      'Confidence is charming. Accuracy is rarer.',
      'You may talk freely. The board will answer for both of us.',
      'A spirited remark. I prefer my rebuttals in moves.',
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  if (lower.includes('human just played')) {
    const replies = [
      move ? `${move}? Ambitious. I do admire courage before consequences.` : 'Interesting. You have chosen drama over caution.',
      move ? `A sharp little gesture with ${move}. I noticed.` : 'You are testing the waters. I intend to make them deep.',
      move ? `${move} enters the story. Let us see if it survives the next chapter.` : 'A respectable try. Respectable will not be enough.',
      move ? `You played ${move}. Brave. Possibly recyclable.` : 'You moved with purpose. I hope it was the right purpose.',
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  if (lower.includes('you (ai) just played')) {
    const replies = [
      move ? `${move}. Clean, efficient, and mildly insulting.` : 'A precise touch. The position deserved nothing less.',
      move ? `I chose ${move}. Not flashy, just correct.` : 'Order has been restored. Briefly.',
      move ? `${move} puts things in their proper place.` : 'I prefer moves that leave a lasting impression.',
      move ? `${move}. The sort of move that makes future problems inevitable.` : 'A little pressure now, a little panic later.',
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  return 'The board remains unconvinced, but I am listening.';
}

router.post('/chat', async (req, res) => {
  const { prompt } = req.body || {};

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ message: 'Missing prompt.' });
  }

  const apiKey =
    (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_new_key_here' ? process.env.GEMINI_API_KEY : null) ||
    process.env.GEMINI_API_SECRET ||
    process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return res.json({ message: buildFallbackMessage(prompt), fallback: true });
  }

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        generationConfig: {
          maxOutputTokens: 100,
          temperature: 0.9,
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini request failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const message = data?.candidates?.[0]?.content?.parts?.map(part => part.text).filter(Boolean).join('\n').trim() || buildFallbackMessage(prompt);
    return res.json({ message });
  } catch (err) {
    console.error('Gemini error:', err);
    return res.json({ message: buildFallbackMessage(prompt), fallback: true });
  }
});

module.exports = router;
