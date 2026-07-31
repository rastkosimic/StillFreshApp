import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { ImageStyle, StyleProp } from 'react-native';

import { useAuthStore } from '@/stores/authStore';

interface Props {
  uri: string | undefined;
  style?: StyleProp<ImageStyle>;
  contentFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  fallback?: React.ReactNode;
}

const CACHE_DIR = `${FileSystem.cacheDirectory}auth_img_v2/`;

function cacheKey(uri: string): string {
  const parts = uri.split('/').filter(Boolean);
  return parts.slice(-2).join('_');
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function AuthImage({ uri, style, contentFit = 'cover', fallback }: Props) {
  const token = useAuthStore((s) => s.token);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Re-run whenever uri OR token changes — token may arrive after first render
  useEffect(() => {
    if (!uri || !token) return;

    setLocalUri(null);
    setFailed(false);

    const dest = `${CACHE_DIR}${cacheKey(uri)}`;
    const headers = { Authorization: `Bearer ${token}` };

    (async () => {
      try {
        await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });

        const info = await FileSystem.getInfoAsync(dest);
        if (info.exists && (info as FileSystem.FileInfo & { size?: number }).size) {
          if (mounted.current) setLocalUri(dest);
          return;
        }

        const response = await fetch(uri, { headers });
        if (!response.ok) {
          if (__DEV__) {
            console.warn('[AuthImage] HTTP', response.status);
          }
          if (mounted.current) setFailed(true);
          return;
        }

        const buffer = await response.arrayBuffer();
        const base64 = toBase64(buffer);
        await FileSystem.writeAsStringAsync(dest, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (mounted.current) setLocalUri(dest);
      } catch {
        if (__DEV__) {
          console.warn('[AuthImage] download failed');
        }
        if (mounted.current) setFailed(true);
      }
    })();
  }, [uri, token]);

  if (failed || !uri) return <>{fallback ?? null}</>;
  if (!localUri) return null;

  return <Image source={{ uri: localUri }} style={style} contentFit={contentFit} />;
}
