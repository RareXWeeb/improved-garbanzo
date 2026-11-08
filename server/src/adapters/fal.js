/**
 * Official Fal.ai Image Generation Adapter.
 * Supports Flux PuLID & IP-Adapter for face and character reference consistency.
 */
export async function generateWithFal(payload, apiKey, modelId = 'fal-ai/flux-pulid') {
  if (!apiKey) {
    throw new Error('Fal.ai API key is missing. Please configure FAL_KEY in server/.env or settings.');
  }

  // Map references into Fal.ai format
  const referenceUrls = (payload.referenceImages || []).map((ref) => ref.dataUri).filter(Boolean);

  const requestBody = {
    prompt: payload.prompt,
    negative_prompt: payload.negativePrompt || '',
    image_size: {
      width: payload.width || 1080,
      height: payload.height || 1920,
    },
    num_inference_steps: payload.parameters?.numInferenceSteps || 28,
    guidance_scale: payload.parameters?.guidanceScale || 4.5,
    reference_images: referenceUrls,
  };

  const endpoint = `https://queue.fal.run/${modelId}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fal.ai API error (${response.status}): ${errorText}`);
  }

  let result = await response.json();

  // If queued, poll until completed
  if (result.status_url) {
    const statusUrl = result.status_url;
    const responseUrl = result.response_url || statusUrl;
    const startTime = Date.now();

    while (Date.now() - startTime < 180000) { // 3-minute timeout
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const pollRes = await fetch(statusUrl, {
        headers: { 'Authorization': `Key ${apiKey}` },
      });
      if (!pollRes.ok) continue;

      const pollData = await pollRes.json();
      if (pollData.status === 'COMPLETED') {
        const finalRes = await fetch(responseUrl, {
          headers: { 'Authorization': `Key ${apiKey}` },
        });
        result = await finalRes.json();
        break;
      } else if (pollData.status === 'FAILED') {
        throw new Error(`Fal.ai generation failed: ${pollData.error || 'Unknown error'}`);
      }
    }
  }

  const imageUrl = result?.images?.[0]?.url || result?.image?.url;
  if (!imageUrl) {
    throw new Error('Fal.ai did not return a valid image URL in the response.');
  }

  // Fetch the resulting image binary
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to download generated image from Fal.ai CDN: ${imgRes.statusText}`);
  }

  const arrayBuffer = await imgRes.arrayBuffer();
  const imageBuffer = Buffer.from(arrayBuffer);
  const mimeType = imgRes.headers.get('content-type') || 'image/png';

  return {
    imageBuffer,
    mimeType,
    costEstimate: 0.035,
    modelUsed: modelId,
  };
}

