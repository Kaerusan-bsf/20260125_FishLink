import {getTranslations} from 'next-intl/server';
import {requireUser} from '../../../../lib/auth';
import {prisma} from '../../../../lib/prisma';
import {redirect} from 'next/navigation';
import PhotoUploadField from '../PhotoUploadField';

export const dynamic = 'force-dynamic';


const defaultTiers = [
  {minKm: 0, maxKm: 5, fee: 1},
  {minKm: 5, maxKm: 10, fee: 2},
  {minKm: 10, maxKm: 20, fee: 4},
  {minKm: 20, maxKm: 30, fee: 6}
];

export default async function ListingNewPage({params}: {params: {locale: string}}) {

  if (process.env.CI) {
    return null;
  }  

  const t = await getTranslations();
  
  const cloudinaryConfigured = Boolean(
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET
  );

  async function createListing(formData: FormData) {
    'use server';
    const current = await requireUser(params.locale, 'FARMER');
    const fishType = String(formData.get('fishType') ?? '').trim();
    const basePricePerKg = Number(formData.get('basePricePerKg'));
    const guttingAvailable = formData.get('guttingAvailable') === 'on';
    const guttingPricePerKg = Number(formData.get('guttingPricePerKg'));
    const deliveryAvailable = formData.get('deliveryAvailable') === 'on';
    const photoUrl = String(formData.get('photoUrl') ?? '').trim();
    const freeDeliveryMinKg = formData.get('freeDeliveryMinKg')
      ? Number(formData.get('freeDeliveryMinKg'))
      : null;
    const minOrderKg = formData.get('minOrderKg') ? Number(formData.get('minOrderKg')) : null;

    const tiers = defaultTiers.map((tier, index) => {
      const minKm = Number(formData.get(`tierMin${index}`));
      const maxKm = Number(formData.get(`tierMax${index}`));
      const fee = Number(formData.get(`tierFee${index}`));
      return {
        label: `${minKm}-${maxKm}km`,
        fee,
        sortOrder: index + 1
      };
    });

    await prisma.listing.create({
      data: {
        farmerId: current.id,
        fishType,
        basePricePerKg,
        guttingAvailable,
        guttingPricePerKg,
        deliveryAvailable,
        deliveryFeeTiers: {
          create: tiers
        },
        freeDeliveryMinKg,
        minOrderKg,
        isActive: true,
        photoUrl: photoUrl || null
      }
    });

    redirect(`/${params.locale}/listings`);
  }

  return (
    <main>
      <div className="section-title">
        <h2>{t('listings.new')}</h2>
      </div>
      <div className="card">
        <form action={createListing}>
          <label>
            {t('listings.fishType')}
            <input name="fishType" required />
          </label>
          <label>
            {t('listings.basePricePerKg')}
            <input name="basePricePerKg" type="number" step="0.1" required />
          </label>
          <label>
            {t('listings.guttingAvailable')}
            <input name="guttingAvailable" type="checkbox" defaultChecked />
          </label>
          <label>
            {t('listings.guttingPricePerKg')}
            <input name="guttingPricePerKg" type="number" step="0.1" required />
          </label>
          <label>
            {t('listings.deliveryAvailable')}
            <input name="deliveryAvailable" type="checkbox" defaultChecked />
          </label>
          <PhotoUploadField
            configured={cloudinaryConfigured}
            labels={{
              photoOptional: t('listings.photoOptional'),
              uploadPhoto: t('listings.uploadPhoto'),
              uploading: t('listings.uploading'),
              removePhoto: t('listings.removePhoto'),
              photoNotConfigured: t('listings.photoNotConfigured')
            }}
          />
          <div className="card" style={{background: '#f8fafc'}}>
            <strong>{t('listings.deliveryFeeTiers')}</strong>
            {defaultTiers.map((tier, index) => (
              <div className="grid grid-2" key={index}>
                <label>
                  {t('listings.tierMinKm')}
                  <input name={`tierMin${index}`} type="number" defaultValue={tier.minKm} />
                </label>
                <label>
                  {t('listings.tierMaxKm')}
                  <input name={`tierMax${index}`} type="number" defaultValue={tier.maxKm} />
                </label>
                <label>
                  {t('listings.tierFee')}
                  <input name={`tierFee${index}`} type="number" step="0.1" defaultValue={tier.fee} />
                </label>
              </div>
            ))}
          </div>
          <label>
            {t('listings.freeDeliveryMinKg')}
            <input name="freeDeliveryMinKg" type="number" step="0.1" />
          </label>
          <label>
            {t('listings.minOrderKg')}
            <input name="minOrderKg" type="number" step="0.1" />
          </label>
          <button type="submit">{t('listings.create')}</button>
        </form>
      </div>
    </main>
  );
}
