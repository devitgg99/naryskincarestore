// Gemini AI Image Generation Service
// Sends an image + user prompt to Gemini, returns a redesigned product image as a blob

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.5-flash-image';


/**
 * Convert a File/Blob to base64 string
 */
const fileToBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/**
 * Convert a base64 string to a Blob
 */
const base64ToBlob = (base64, mimeType = 'image/png') => {
  const byteChars = atob(base64);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
};

/**
 * Send image + prompt to Gemini and get back a redesigned product image
 * @param {File} imageFile - The original product photo file
 * @param {string} userPrompt - Custom instructions from the user
 * @returns {Promise<{ blob: Blob, previewUrl: string }>}
 */
export const redesignProductImage = async (imageFile, userPrompt) => {
  if (!GEMINI_API_KEY) {
    throw new Error(
      'Gemini API key is missing. Please add VITE_GEMINI_API_KEY to your .env file.\nGet a free key at: https://aistudio.google.com/apikey'
    );
  }

  // Convert image to base64
  const base64Image = await fileToBase64(imageFile);
  const mimeType = imageFile.type || 'image/jpeg';

  // Build the prompt — combine user instructions with a base system context
  const fullPrompt = userPrompt?.trim()
    ? `${userPrompt.trim()}. This is a product photo for a wholesale store catalog.`
    : 'Create a clean, professional product photo. Pure white background, keep the product exactly as shown, improve brightness and sharpness. No shadows, no clutter. Suitable for a retail product catalog.';

  const requestBody = {
    contents: [
      {
        parts: [
          { text: fullPrompt },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image,
            },
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const message = errData?.error?.message || `HTTP ${response.status}`;

    // Give a friendlier message for quota/billing errors
    if (response.status === 429 || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
      throw new Error(
        'Image generation requires billing to be enabled on your Gemini API key.\n\n' +
        'Steps to fix:\n' +
        '1. Go to aistudio.google.com → Get API key\n' +
        '2. Enable billing on your Google Cloud project\n' +
        '3. Cost is ~$0.04 per image (pay-as-you-go)\n\n' +
        'Alternatively, you can save products without an AI image and upload the raw photo directly.'
      );
    }

    throw new Error(`Gemini API error: ${message}`);
  }


  const data = await response.json();

  // Extract image part from response
  const candidates = data?.candidates || [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      if (part.inline_data?.data) {
        const outputMime = part.inline_data.mime_type || 'image/png';
        const blob = base64ToBlob(part.inline_data.data, outputMime);
        const previewUrl = URL.createObjectURL(blob);
        return { blob, previewUrl };
      }
    }
  }

  throw new Error('Gemini returned no image in the response. Try a different prompt or image.');
};
