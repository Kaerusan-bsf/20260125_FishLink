import {getTranslations} from 'next-intl/server';
import {requireUser} from '../../../lib/auth';
import {prisma} from '../../../lib/prisma';
import {redirect} from 'next/navigation';
import Link from 'next/link';
import RestaurantListingsView from './RestaurantListingsView';

export const dynamic = 'force-dynamic';

// SQLite版では deliveryFeeTiers は別テーブル（label/fee/sortOrder）
function formatTiers(t: (key: string, params?: any) => string, tiers: any) {
  if (!Array.isArray(tiers) || tiers.length === 0) return '-';
  return tiers
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((tier) => {
      // 表示： "0-5km: $1" みたいに出す（翻訳キーがあればそれを使う）
      // 既存の tierFormat が min/max 前提なら、いったん label/fee で組み立てる
      try {
        return t('listings.tierLabelFee', {label: tier.label, fee: tier.fee});
      } catch {
        return `${tier.label}: ${tier.fee}`;
      }
    })
    .join(', ');
}

export default async function ListingsPage({params}: {params: {locale: string}}) {
  const t = await getTranslations();
  const user = await requireUser(params.locale);

  async function updateListing(formData: FormData) {
    'use server';
    // Role enum は使わない（stringで統一）
    const current = await requireUser(params.locale, 'FARMER');
    const listingId = String(formData.get('listingId'));
    const isActive = formData.get('isActive') === 'on';
    await prisma.listing.update({
      where: {id: listingId, farmerId: current.id},
      data: {isActive}
    });
    redirect(`/${params.locale}/listings`);
  }

  // FARMER view
  if (user.role === 'FARMER') {
    const listings = await prisma.listing.findMany({
      where: {farmerId: user.id},
      include: {deliveryFeeTiers: true},
      orderBy: {updatedAt: 'desc'}
    });

    return (
      <main>
        <div className="section-title">
          <h2>{t('listings.myListings')}</h2>
          <Link href={`/${params.locale}/listings/new`}>
            <button>{t('listings.new')}</button>
          </Link>
        </div>

        <div className="grid">
          {listings.map((listing) => (
            <div className="card" key={listing.id}>
              <h3>{listing.fishType}</h3>
              <p className="muted">
                {t('listings.basePricePerKg')}: {listing.basePricePerKg}
              </p>
              <p className="muted">
                {t('listings.deliveryFeeTiers')}: {formatTiers(t, listing.deliveryFeeTiers)}
              </p>

              <form action={updateListing}>
                <input type="hidden" name="listingId" value={listing.id} />
                <label>
                  {t('listings.isActive')}
                  <input name="isActive" type="checkbox" defaultChecked={listing.isActive} />
                </label>
                <button type="submit" className="secondary">
                  {t('listings.save')}
                </button>
              </form>
            </div>
          ))}
        </div>
      </main>
    );
  }

  // RESTAURANT view
  const listings = await prisma.listing.findMany({
    where: {isActive: true},
    include: {farmer: {include: {profile: true}}, deliveryFeeTiers: true},
    orderBy: {updatedAt: 'desc'}
  });

  const pricing = await prisma.pricingConfig.findFirst({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' }
  });
  const alpha = pricing?.alphaRate ?? 0;

  const listingsView = listings.map((listing) => ({
    id: listing.id,
    farmerName: listing.farmer.profile?.entityName ?? '-',
    province: listing.farmer.profile?.province ?? null,
    district: listing.farmer.profile?.district ?? null,
    fishType: listing.fishType,
    basePricePerKg: listing.basePricePerKg,
    displayPricePerKg: listing.basePricePerKg * (1 + alpha), 
    deliveryAvailable: listing.deliveryAvailable,
    deliveryFeeTiersLabel: formatTiers(t, listing.deliveryFeeTiers),
    freeDeliveryMinKg: listing.freeDeliveryMinKg ?? null,
    minOrderKg: listing.minOrderKg ?? null,
    updatedAtLabel: listing.updatedAt.toLocaleDateString(),
    photoUrl: listing.photoUrl ?? null
  }));

  const labels = {
    list: t('listings.view.list'),
    grid: t('listings.view.grid'),
    farmerName: t('profile.entityName'),
    fishType: t('listings.fishType'),
    basePricePerKg: t('listings.basePricePerKg'),
    deliveryAvailable: t('listings.deliveryAvailable'),
    deliveryFeeTiers: t('listings.deliveryFeeTiers'),
    freeDeliveryMinKg: t('listings.freeDeliveryMinKg'),
    minOrderKg: t('listings.minOrderKg'),
    updatedAt: t('listings.updatedAt'),
    order: t('listings.order'),
    yes: t('common.yes'),
    no: t('common.no')
  };

  return (
    <main>
      <h2>{t('listings.title')}</h2>
      <RestaurantListingsView locale={params.locale} listings={listingsView} labels={labels} />
    </main>
  );
}
