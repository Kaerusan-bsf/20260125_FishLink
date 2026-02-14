import {getTranslations} from 'next-intl/server';
import {redirect} from 'next/navigation';
import ListingCreateForm from './ListingCreateForm';

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

    const { requireUser } = await import('../../../../lib/auth');
    const { prisma } = await import('../../../../lib/prisma');
    const {Prisma} = await import('@prisma/client');

    const current = await requireUser(params.locale, 'FARMER');
    const requestIdRaw = String(formData.get('requestId') ?? '').trim();
    const requestId = requestIdRaw || crypto.randomUUID();
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

    let listing = null;
    try {
      listing = await prisma.listing.create({
        data: {
          requestId,
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
    } catch (error) {
      const isDuplicateRequestId =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        Array.isArray(error.meta?.target) &&
        error.meta?.target.includes('requestId');

      if (isDuplicateRequestId) {
        listing = await prisma.listing.findUnique({
          where: {requestId}
        });
      } else {
        throw error;
      }
    }

    if (!listing) {
      throw new Error('Failed to create or fetch listing by requestId');
    }

    redirect(`/${params.locale}/listings`);
  }

  return (
    <main>
      <div className="section-title">
        <h2>{t('listings.new')}</h2>
      </div>
      <div className="card">
        <ListingCreateForm
          createListingAction={createListing}
          cloudinaryConfigured={cloudinaryConfigured}
          defaultTiers={defaultTiers}
          labels={{
            fishType: t('listings.fishType'),
            basePricePerKg: t('listings.basePricePerKg'),
            guttingAvailable: t('listings.guttingAvailable'),
            guttingPricePerKg: t('listings.guttingPricePerKg'),
            deliveryAvailable: t('listings.deliveryAvailable'),
            deliveryFeeTiers: t('listings.deliveryFeeTiers'),
            tierMinKm: t('listings.tierMinKm'),
            tierMaxKm: t('listings.tierMaxKm'),
            tierFee: t('listings.tierFee'),
            freeDeliveryMinKg: t('listings.freeDeliveryMinKg'),
            minOrderKg: t('listings.minOrderKg'),
            create: t('listings.create'),
            submitting: `${t('listings.create')}...`,
            photoOptional: t('listings.photoOptional'),
            uploadPhoto: t('listings.uploadPhoto'),
            uploading: t('listings.uploading'),
            removePhoto: t('listings.removePhoto'),
            photoNotConfigured: t('listings.photoNotConfigured')
          }}
        />
      </div>
    </main>
  );
}
