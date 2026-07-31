import { Platform } from 'react-native';

import { multipartClient } from './apiClient';
import { API_BASE_URL } from '@/config/api';

function normalizeImageUrl(url: string): string {
  return url.replace(/https?:\/\/localhost(:\d+)?/, API_BASE_URL);
}

export interface UploadImageResponse {
  imageUrl: string;
}

function buildFormData(imageUri: string, fallbackName: string): FormData {
  const formData = new FormData();
  const filename = imageUri.split('/').pop() ?? fallbackName;
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

  formData.append('image', {
    uri: Platform.OS === 'android' ? imageUri : imageUri.replace('file://', ''),
    name: filename,
    type: mimeType,
  } as unknown as Blob);

  return formData;
}

/**
 * Uploads an offer image.
 * Spec: POST /images/upload → { imageUrl: string }
 */
export async function uploadImage(imageUri: string): Promise<UploadImageResponse> {
  const response = await multipartClient.post<UploadImageResponse>(
    '/images/upload',
    buildFormData(imageUri, 'offer.jpg'),
  );
  return { imageUrl: normalizeImageUrl(response.data.imageUrl) };
}

/**
 * Uploads a vendor profile image.
 * Spec: POST /vendors/upload-profile-image → { imageUrl: string }
 */
export async function uploadVendorProfileImage(imageUri: string): Promise<UploadImageResponse> {
  const response = await multipartClient.post<UploadImageResponse>(
    '/vendors/upload-profile-image',
    buildFormData(imageUri, 'profile.jpg'),
  );
  return { imageUrl: normalizeImageUrl(response.data.imageUrl) };
}
