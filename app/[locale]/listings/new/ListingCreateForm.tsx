'use client';

import {FormEvent, useRef, useState} from 'react';
import PhotoUploadField from '../PhotoUploadField';

type TierInput = {
  minKm: number;
  maxKm: number;
  fee: number;
};

type Props = {
  createListingAction: (formData: FormData) => void;
  cloudinaryConfigured: boolean;
  defaultTiers: TierInput[];
  labels: {
    fishType: string;
    basePricePerKg: string;
    guttingAvailable: string;
    guttingPricePerKg: string;
    deliveryAvailable: string;
    deliveryFeeTiers: string;
    tierMinKm: string;
    tierMaxKm: string;
    tierFee: string;
    freeDeliveryMinKg: string;
    minOrderKg: string;
    create: string;
    submitting: string;
    photoOptional: string;
    uploadPhoto: string;
    uploading: string;
    removePhoto: string;
    photoNotConfigured: string;
  };
};

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ListingCreateForm({
  createListingAction,
  cloudinaryConfigured,
  defaultTiers,
  labels
}: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitGuardRef = useRef(false);
  const requestIdInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (submitGuardRef.current) {
      event.preventDefault();
      return;
    }

    submitGuardRef.current = true;
    if (requestIdInputRef.current) {
      requestIdInputRef.current.value = generateRequestId();
    }
    setIsSubmitting(true);
  }

  return (
    <form action={createListingAction} onSubmit={handleSubmit}>
      <input ref={requestIdInputRef} type="hidden" name="requestId" defaultValue="" />

      <label>
        {labels.fishType}
        <input name="fishType" required />
      </label>
      <label>
        {labels.basePricePerKg}
        <input name="basePricePerKg" type="number" step="0.1" required />
      </label>
      <label>
        {labels.guttingAvailable}
        <input name="guttingAvailable" type="checkbox" defaultChecked />
      </label>
      <label>
        {labels.guttingPricePerKg}
        <input name="guttingPricePerKg" type="number" step="0.1" required />
      </label>
      <label>
        {labels.deliveryAvailable}
        <input name="deliveryAvailable" type="checkbox" defaultChecked />
      </label>
      <PhotoUploadField
        configured={cloudinaryConfigured}
        labels={{
          photoOptional: labels.photoOptional,
          uploadPhoto: labels.uploadPhoto,
          uploading: labels.uploading,
          removePhoto: labels.removePhoto,
          photoNotConfigured: labels.photoNotConfigured
        }}
      />
      <div className="card" style={{background: '#f8fafc'}}>
        <strong>{labels.deliveryFeeTiers}</strong>
        {defaultTiers.map((tier, index) => (
          <div className="grid grid-2" key={index}>
            <label>
              {labels.tierMinKm}
              <input name={`tierMin${index}`} type="number" defaultValue={tier.minKm} />
            </label>
            <label>
              {labels.tierMaxKm}
              <input name={`tierMax${index}`} type="number" defaultValue={tier.maxKm} />
            </label>
            <label>
              {labels.tierFee}
              <input name={`tierFee${index}`} type="number" step="0.1" defaultValue={tier.fee} />
            </label>
          </div>
        ))}
      </div>
      <label>
        {labels.freeDeliveryMinKg}
        <input name="freeDeliveryMinKg" type="number" step="0.1" />
      </label>
      <label>
        {labels.minOrderKg}
        <input name="minOrderKg" type="number" step="0.1" />
      </label>
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? labels.submitting : labels.create}
      </button>
    </form>
  );
}
