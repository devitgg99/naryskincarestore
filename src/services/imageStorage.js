// Supabase Storage Service — Product Images
// Uploads product images to the 'product-images' bucket and returns public URLs

import { createClient } from '@supabase/supabase-js';

const BUCKET = 'product-images';

const getStorageClient = () => {
  const url = localStorage.getItem('wsp_supabase_url') || import.meta.env.VITE_SUPABASE_URL || '';
  const key = localStorage.getItem('wsp_supabase_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  return createClient(url, key);
};

/**
 * Upload a product image blob/file to Supabase Storage
 * @param {Blob|File} imageBlob - The image to upload (original or AI-generated)
 * @param {string} productId - Used to create a unique filename
 * @param {string} [mimeType] - e.g. 'image/png' or 'image/jpeg'
 * @returns {Promise<string>} The public URL of the uploaded image
 */
export const uploadProductImage = async (imageBlob, productId, mimeType = 'image/png') => {
  const client = getStorageClient();
  if (!client) {
    throw new Error('Supabase is not configured. Please set your Supabase credentials in Settings.');
  }

  const ext = mimeType === 'image/jpeg' ? 'jpg' : 'png';
  const filename = `${productId}_${Date.now()}.${ext}`;
  const filePath = `products/${filename}`;

  const { error } = await client.storage
    .from(BUCKET)
    .upload(filePath, imageBlob, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) throw new Error(`Image upload failed: ${error.message}`);

  // Get the public URL
  const { data } = client.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
};

/**
 * Delete a product image from Supabase Storage by its public URL
 * @param {string} imageUrl - The full public URL to delete
 */
export const deleteProductImage = async (imageUrl) => {
  if (!imageUrl) return;
  const client = getStorageClient();
  if (!client) return;

  try {
    // Extract the file path from the URL
    // URL format: https://xxx.supabase.co/storage/v1/object/public/product-images/products/filename.png
    const url = new URL(imageUrl);
    const pathParts = url.pathname.split(`/object/public/${BUCKET}/`);
    if (pathParts.length < 2) return;
    const filePath = pathParts[1];

    await client.storage.from(BUCKET).remove([filePath]);
  } catch {
    // Non-critical: log and continue
    console.warn('Could not delete old product image:', imageUrl);
  }
};
