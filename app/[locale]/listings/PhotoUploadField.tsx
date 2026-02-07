'use client';

import {useState} from 'react';

type Labels = {
  photoOptional: string;
  uploadPhoto: string;
  uploading: string;
  removePhoto: string;
  photoNotConfigured: string;
};

export default function PhotoUploadField({
  labels,
  configured
}: {
  labels: Labels;
  configured: boolean;
}) {
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!configured) return;

    setUploading(true);
    setError(null);

    try {
      const sigRes = await fetch('/api/cloudinary/signature');
      if (!sigRes.ok) {
        setError(labels.photoNotConfigured);
        setUploading(false);
        return;
      }
      const sig = await sigRes.json();

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', sig.apiKey);
      formData.append('timestamp', String(sig.timestamp));
      formData.append('signature', sig.signature);
      formData.append('folder', sig.folder);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) {
        setError(labels.photoNotConfigured);
        setUploading(false);
        return;
      }

      const result = await uploadRes.json();
      setPhotoUrl(result.secure_url ?? '');
    } catch {
      setError(labels.photoNotConfigured);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="card">
      <label>
        {labels.photoOptional}
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={!configured || uploading}
        />
      </label>
      <p className="muted">{labels.uploadPhoto}</p>
      {uploading ? <p className="muted">{labels.uploading}</p> : null}
      {error ? <p className="notice" style={{background: '#fee2e2', color: '#991b1b'}}>{error}</p> : null}
      {!configured ? <p className="muted">{labels.photoNotConfigured}</p> : null}

      {photoUrl ? (
        <div style={{display: 'grid', gap: 8}}>
          <img
            src={photoUrl}
            alt="uploaded"
            style={{width: '100%', height: 160, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)'}}
          />
          <button type="button" className="secondary" onClick={() => setPhotoUrl('')}>
            {labels.removePhoto}
          </button>
        </div>
      ) : null}

      <input type="hidden" name="photoUrl" value={photoUrl} />
    </div>
  );
}
