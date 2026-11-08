/**
 * Official OpenAI DALL-E 3 Image Generation Adapter.
 * Note: DALL-E 3 API is text-prompt conditioned only and does not accept reference image inputs.
 */
export async function generateWithOpenAI(payload, apiKey) {
  if (!apiKey) {
    throw new Error('OpenAI API key is missing. Please configure OPENAI_API_KEY in server/.env or settings.');
  }

  const endpoint = 'https://api.openai.com/v1/images/generations';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: payload.prompt,
      size: '1024x1792', // Vertical portrait approx 9:16
      quality: 'standard',
      response_format: 'b64_json',
      n: 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error('OpenAI did not return b64_json image data.');
  }

  const imageBuffer = Buffer.from(b64, 'base64');

  return {
    imageBuffer,
    mimeType: 'image/png',
    costEstimate: 0.080,
    modelUsed: 'openai/dall-e-3',
  };
}
