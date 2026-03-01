import ExifReader from 'exifreader';
import type { PhotoMeta } from '../services/api';

export interface FileEntry {
    file: File;
    preview: string;
    meta: PhotoMeta;
    exifLoading: boolean;  // true while EXIF is being read
    status: 'idle' | 'uploading' | 'done' | 'error';
    error?: string;
}

export const defaultMeta = (): PhotoMeta => ({
    title: '',
    date: new Date().toISOString().slice(0, 10),
    location: '',
    description: '',
});

export async function reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10`,
            { headers: { 'Accept-Language': 'en' } }
        );
        const data = await res.json();
        const addr = data?.address ?? {};
        // Build a human-readable string: city/town/village, state/country
        const parts = [
            addr.city ?? addr.town ?? addr.village ?? addr.hamlet ?? addr.county,
            addr.state ?? addr.region,
            addr.country,
        ].filter(Boolean);
        return parts.join(', ');
    } catch {
        return '';
    }
}

export async function extractExifMeta(file: File): Promise<Partial<PhotoMeta>> {
    const result: Partial<PhotoMeta> = {};

    try {
        // expanded:true gives computed gps.Latitude / gps.Longitude
        const tags = await ExifReader.load(file, { expanded: true });

        // ── Date ───────────────────────────────────────────────────────────────
        const rawDate =
            tags.exif?.DateTimeOriginal?.description ??
            tags.exif?.DateTime?.description ??
            tags.exif?.DateTimeDigitized?.description;
        if (rawDate) {
            // EXIF date strings use colons: "2024:01:15 14:30:00" → normalise to ISO
            const d = new Date(String(rawDate).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3'));
            if (!isNaN(d.getTime())) result.date = d.toISOString().slice(0, 10);
        }

        // ── GPS → store raw coords + reverse geocode for display name ──────────
        const lat = tags.gps?.Latitude;
        const lon = tags.gps?.Longitude;
        if (lat != null && lon != null) {
            result.latitude = lat;
            result.longitude = lon;
            result.location = await reverseGeocode(lat, lon);
        }
    } catch (err) {
        console.warn('[EXIF] extraction failed for', file.name, err);
    }

    return result;
}
