/**
 * Official Replicate Image Generation Adapter.
 * Supports Flux with multi-reference conditioning.
 */
export async function generateWithReplicate(payload, apiKey, modelVersion) {
  if (!apiKey) {
    throw new Error('Replicate API token is missing. Please configure REPLICATE_API_TOKEN in server/.env or settings.');
  }

  const referenceUrls = (payload.referenceImages || []).map((ref) => ref.dataUri).filter(Boolean);

  const input = {
    prompt: payload.prompt,
    negative_prompt: payload.negativePrompt || '',
    aspect_ratio: payload.aspectRatio || '9:16',
    output_format: 'png',
    output_quality: 90,
  };

  if (referenceUrls.length > 0) {
    input.image = referenceUrls[0];
    if (referenceUrls.length > 1) {
      input.extra_images = referenceUrls.slice(1);
    }
  }

  // Submit prediction
  const endpoint = 'https://api.replicate.com/v1/predictions';
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait',
    },
    body: JSON.stringify({
      version: modelVersion || '854e8727d6cb7a17304929123131b65f86b87d33cb77d280474da24f144c1692', // Flux Dev
      input,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Replicate API error (${response.status}): ${errorText}`);
  }

  let prediction = await response.json();
  const startTime = Date.now();

  while (prediction.status !== 'succeeded' && prediction.status !== 'failed' && prediction.status !== 'canceled') {
    if (Date.now() - startTime > 180000) {
      throw new Error('Replicate generation timed out after 3 minutes.');
    }
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(prediction.urls.get, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });
    if (pollRes.ok) {
      prediction = await pollRes.json();
    }
  }

  if (prediction.status !== 'succeeded') {
    throw new Error(`Replicate generation failed: ${prediction.error || 'Unknown status'}`);
  }

  const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (!outputUrl) {
    throw new Error('Replicate did not return an output image URL.');
  }

  const imgRes = await fetch(outputUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to download output from Replicate CDN: ${imgRes.statusText}`);
  }

  const arrayBuffer = await imgRes.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);
  const mimeType = imgRes.headers.get('content-type') || 'image/png';

  return {
    imageBuffer,
    mimeType,
    costEstimate: 0.040,
    modelUsed: 'replicate/flux',
  };
}
