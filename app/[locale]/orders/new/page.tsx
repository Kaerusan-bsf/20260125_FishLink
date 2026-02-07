import {getTranslations} from 'next-intl/server';
import {requireUser} from '../../../../lib/auth';
import {prisma} from '../../../../lib/prisma';
import {redirect} from 'next/navigation';
import {
  computeExpiresAt,
  computeExpiresAtByDate,
  computeRequestedDate,
  PHNOM_PENH
} from '../../../../lib/expiration';
import {createNotification} from '../../../../lib/notifications';
import {DateTime} from 'luxon';
import OrderFormClient from './OrderFormClient';

export const dynamic = 'force-dynamic';

// deliveryFeeTiers は別テーブル（label/fee/sortOrder）
function formatTiers(t: (key: string, params?: any) => string, tiers: any) {
  if (!Array.isArray(tiers) || tiers.length === 0) return '-';
  return tiers
    .slice()
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((tier) => {
      // messages に tierLabelFee が無い場合でも落ちないように
      try {
        return t('listings.tierLabelFee', {label: tier.label, fee: tier.fee});
      } catch {
        return `${tier.label}: ${tier.fee}`;
      }
    })
    .join(', ');
}

export default async function OrderNewPage({
  params,
  searchParams
}: {
  params: {locale: string};
  searchParams: {listingId?: string; reorderId?: string; error?: string};
}) {
  const t = await getTranslations();
  const error = searchParams.error;
  const todayDate = DateTime.now().setZone(PHNOM_PENH).toISODate();

  // Role enumは使わず string
  await requireUser(params.locale, 'RESTAURANT');

  const listingId = searchParams.listingId;
  if (!listingId) {
    redirect(`/${params.locale}/listings`);
  }

  const listing = await prisma.listing.findUnique({
    where: {id: listingId},
    include: {
      farmer: {include: {profile: true}},
      deliveryFeeTiers: true
    }
  });

  if (!listing) {
    redirect(`/${params.locale}/listings`);
  }

  const reorder = searchParams.reorderId
    ? await prisma.order.findUnique({where: {id: searchParams.reorderId}})
    : null;

  async function createOrder(formData: FormData) {
    'use server';
    const current = await requireUser(params.locale, 'RESTAURANT');

    const listingIdInput = String(formData.get('listingId') ?? '');
    const quantityKg = Number(formData.get('quantityKg'));
    const sizeRequestText = String(formData.get('sizeRequestText') ?? '').trim();
    const timeBand = String(formData.get('timeBand') ?? ''); // "MORNING" | "AFTERNOON" | "NIGHT"
    const dayOffset = Number(formData.get('dayOffset'));
    const selectedDate = String(formData.get('selectedDate') ?? '').trim();
    const timeDetail = String(formData.get('timeDetail') ?? '').trim();
    const memo = String(formData.get('memo') ?? '').trim();
    const guttingRequested = formData.get('guttingRequested') === 'on';
    const deliveryRequested = formData.get('deliveryRequested') === 'on';

    if (!listingIdInput || !quantityKg || !sizeRequestText || !timeBand) {
      redirect(`/${params.locale}/orders`);
    }

    const listingForOrder = await prisma.listing.findUnique({
      where: {id: listingIdInput},
      include: {
        farmer: {include: {profile: true}},
        deliveryFeeTiers: true
      }
    });
    if (!listingForOrder) {
      redirect(`/${params.locale}/listings`);
    }

    // RestaurantはUser直下ではなく profile に電話/Mapが入っている
    const restaurant = await prisma.user.findUnique({
      where: {id: current.id},
      include: {profile: true}
    });
    if (!restaurant?.profile) {
      redirect(`/${params.locale}/profile`);
    }

    const pricing = await prisma.pricingConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    });
    const pricingVersionSnap = pricing?.pricingVersion ?? null;
    const alphaRateSnap = pricing?.alphaRate ?? 0;
    const betaRateSnap = pricing?.betaRate ?? 0;
    const betaDiscountRateSnap = pricing?.betaDiscountRate ?? 0;

    let expiresAt: Date;
    let requestedDate: string;

    if (selectedDate) {
      requestedDate = selectedDate;
      expiresAt = computeExpiresAtByDate(timeBand, selectedDate);
    } else {
      if (!Number.isFinite(dayOffset)) {
        redirect(`/${params.locale}/orders`);
      }
      const maybeRequestedDate = computeRequestedDate(dayOffset);
      if (!maybeRequestedDate) {
        redirect(`/${params.locale}/orders`);
      }
      requestedDate = maybeRequestedDate;
      expiresAt = computeExpiresAt(timeBand, dayOffset);

    }
    const now = DateTime.now().setZone(PHNOM_PENH);
    if (DateTime.fromJSDate(expiresAt).setZone(PHNOM_PENH) <= now) {
      const query = new URLSearchParams({
        listingId: listingForOrder.id,
        error: 'expired_time'
      });
      if (searchParams.reorderId) {
        query.set('reorderId', searchParams.reorderId);
      }
      redirect(`/${params.locale}/orders/new?${query.toString()}`);
    }

    const finalGuttingRequested = listingForOrder.guttingAvailable ? guttingRequested : false;
    const finalDeliveryRequested = listingForOrder.deliveryAvailable ? deliveryRequested : false;

    // 受け渡し地点（自動）
    const handoffMapSnap = finalDeliveryRequested
      ? restaurant.profile.googleMapUrl
      : (listingForOrder.farmer.profile?.googleMapUrl ?? '');

    const order = await prisma.order.create({
      data: {
        listingId: listingForOrder.id,
        restaurantId: current.id,
        farmerId: listingForOrder.farmerId,

        quantityKg,
        sizeRequestText,
        timeBand,
        timeDetail: timeDetail || null,
        memo: memo || null,

        guttingRequested: finalGuttingRequested,
        deliveryRequested: finalDeliveryRequested,

        status: 'REQUESTED',
        expiresAt,
        requestedDate,

        // schema の Snap 名に合わせる
        restaurantPhoneSnap: restaurant.profile.phone,
        restaurantMapSnap: restaurant.profile.googleMapUrl,
        farmerPhoneSnap: listingForOrder.farmer.profile?.phone ?? '',
        farmerMapSnap: listingForOrder.farmer.profile?.googleMapUrl ?? '',
        handoffMapSnap,

        basePricePerKgSnap: listingForOrder.basePricePerKg,
        guttingPricePerKgSnap: listingForOrder.guttingPricePerKg,

        pricingVersionSnap,
        alphaRateSnap,
        betaRateSnap,
        betaDiscountRateSnap
      }
    });

    await createNotification({
      userId: listingForOrder.farmerId,
      titleKey: 'notifications.orderRequested.title',
      bodyKey: 'notifications.orderRequested.body',
      params: {orderId: order.id}
    });

    redirect(`/${params.locale}/orders/${order.id}`);
  }

    // UI用（概算表示）：PricingConfigのα/βを取得
    const pricingForUi = await prisma.pricingConfig.findFirst({
      where: {isActive: true},
      orderBy: {updatedAt: 'desc'}
    });
    const alphaUi = pricingForUi?.alphaRate ?? 0;
    const betaUi = pricingForUi?.betaRate ?? 0;
  
    // 一覧と同じ「α込み単価」
    const displayUnitPricePerKg = listing.basePricePerKg * (1 + alphaUi);
  
    // 配送費レンジ（tier fee の min / max）
    const feeNums = (listing.deliveryFeeTiers ?? [])
      .map((tier) => Number(tier.fee))
      .filter((n) => Number.isFinite(n));
    const deliveryMin = feeNums.length ? Math.min(...feeNums) : 0;
    const deliveryMax = feeNums.length ? Math.max(...feeNums) : 0;

  const tiersLabel = formatTiers(t, listing.deliveryFeeTiers);

  return (
    <main>
      <div className="section-title">
        <h2>{t('orders.createTitle')}</h2>
      </div>
      {error === 'expired_time' ? (
        <p className="notice" style={{background: '#fee2e2', color: '#991b1b'}}>
          {t('orders.expiredTimeError')}
        </p>
      ) : null}
      <div className="card">
        <p className="muted">
          {(listing.farmer.profile?.entityName ?? '-') } / {listing.fishType}
        </p>
        {listing.farmer.profile?.province ? (
          <p className="muted" style={{marginTop: 4}}>
            📍 {listing.farmer.profile.province}
            {listing.farmer.profile.district ? ` / ${listing.farmer.profile.district}` : ''}
          </p>
        ) : null}

{listing.farmer.profile?.googleMapUrl ? (
  <p style={{marginTop: 4}}>
    <a href={listing.farmer.profile.googleMapUrl} target="_blank" rel="noreferrer">
      農家の場所を地図で見る
    </a>
  </p>
) : null}

        <OrderFormClient
          locale={params.locale}
          listingId={listing.id}
          todayDate={todayDate}
          tiersLabel={tiersLabel}
          guttingAvailable={listing.guttingAvailable}
          deliveryAvailable={listing.deliveryAvailable}
          defaultValues={{
            quantityKg: reorder?.quantityKg != null ? String(reorder.quantityKg) : '',
            sizeRequestText: reorder?.sizeRequestText ?? '',
            timeBand: reorder?.timeBand ?? '',
            timeDetail: reorder?.timeDetail ?? '',
            memo: reorder?.memo ?? '',
            guttingRequested: Boolean(reorder?.guttingRequested ?? false),
            deliveryRequested: Boolean(reorder?.deliveryRequested ?? false)
          }}
          displayUnitPricePerKg={displayUnitPricePerKg}
          guttingPricePerKg={listing.guttingPricePerKg}
          betaRate={betaUi}
          deliveryMin={deliveryMin}
          deliveryMax={deliveryMax}
          freeDeliveryMinKg={listing.freeDeliveryMinKg ?? null}
          labels={{
            quantityKg: t('orders.quantityKg'),
            sizeRequestText: t('orders.sizeRequestText'),
            requestedDateLabel: t('orders.requestedDateLabel'),
            today: t('orders.today'),
            tomorrow: t('orders.tomorrow'),
            dayAfterTomorrow: t('orders.dayAfterTomorrow'),
            pickDate: t('orders.pickDate'),
            orPickFromCalendar: t('orders.orPickFromCalendar'),
            timeBand: t('orders.timeBand'),
            timeDetail: t('orders.timeDetail'),
            memo: t('orders.memo'),
            guttingRequested: t('orders.guttingRequested'),
            deliveryRequested: t('orders.deliveryRequested'),
            submit: t('orders.submit'),

            // ↓ 概算UI（B：内訳＋合計レンジ）
            estimateTitle: t('orders.estimate'),

            // ここは「テキストラベル」だけ欲しいので直書きでもOK（β）
            estimateFish: '魚代（参考）',
            estimateGutting: '下処理（参考）',
            estimateSupport: '取引サポート料（参考）',
            estimateDelivery: '配送費（目安）',
            estimateTotal: '合計（参考）',
            estimateNote: '※最終金額は農家の承認時に確定します（配送費は距離帯により変動）',
            freeDeliveryHint: '送料無料（{minKg}kg以上）'
          }}
          timeBandOptions={{
            morning: t('timeBand.morning'),
            afternoon: t('timeBand.afternoon'),
            night: t('timeBand.night')
          }}
          createOrderAction={createOrder}
        />
      </div>
    </main>
  );
}
