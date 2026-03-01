// In dev, VITE_API_URL is '' so requests are relative and proxied by Vite (no CORS).
// In production, VITE_API_URL is the full API URL.
const API_BASE = import.meta.env.VITE_API_URL ?? '';

export async function apiPost<T = unknown>(path: string, body: object, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Request failed');
  return data as T;
}

export async function apiGet<T = unknown>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Request failed');
  return data as T;
}

export async function apiPatch<T = unknown>(path: string, body: object, token?: string): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Request failed');
  return data as T;
}

export async function apiDelete<T = unknown>(path: string, token?: string): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail ?? 'Request failed');
  return data as T;
}

// ── Board & Photo helpers ─────────────────────────────────────────────────

export interface Photo {
  photo_id: string;
  filename: string;
  s3_key: string;
  url: string;
  status: string;
  uploaded_at: string;
  created_at?: string;
  updated_at?: string;
  // optional metadata
  title?: string;
  date?: string;
  location?: string;
  description?: string;
}

export interface PhotoMeta {
  title: string;
  date: string;
  location: string;
  description: string;
}

export interface Board {
  board_id: string;
  name: string;
  photo_count: number;
  created_at: string;
}

export async function getBoard(boardId: string, token: string): Promise<{ board: Board; photos: Photo[] }> {
  return apiGet(`/boards/${boardId}`, token);
}

export async function getUploadUrl(
  boardId: string,
  filename: string,
  token: string,
  contentType: string = 'image/jpeg',
  fileSize: number = 0,
): Promise<{ photo_id: string; upload_url: string }> {
  return apiPost(`/boards/${boardId}/photos/upload-url`, { filename, content_type: contentType, file_size: fileSize }, token);
}

export async function uploadToS3(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Upload to S3 failed (${res.status})${text ? ': ' + text : ''}`);
  }
}

export async function confirmPhoto(
  boardId: string,
  photoId: string,
  token: string,
  meta?: { title: string; date: string; location: string; description: string },
): Promise<void> {
  await apiPost(`/boards/${boardId}/photos/${photoId}/confirm`, meta ?? {}, token);
}

export async function updatePhoto(
  boardId: string,
  photoId: string,
  token: string,
  meta: Partial<PhotoMeta>,
): Promise<void> {
  await apiPatch(`/boards/${boardId}/photos/${photoId}`, meta, token);
}

export async function deletePhoto(boardId: string, photoId: string, token: string): Promise<void> {
  await apiDelete(`/boards/${boardId}/photos/${photoId}`, token);
}
