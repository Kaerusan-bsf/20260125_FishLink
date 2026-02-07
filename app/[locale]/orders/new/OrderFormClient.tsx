'use client';

import {useMemo, useState} from 'react';
import OrderEstimate from './OrderEstimate';

type Props = {
  locale: string;
  listingId: string;

  // 表示・初期値
  todayDate: string | null;
  tiersLabel: string;
  guttingAvailable: boolean;
  deliveryAvailable: boolean;

  defaultValues: {
    quantityKg: string;
    sizeRequestText: string;
    timeBand: string;
    timeDetail: string;
    memo: string;
    guttingRequested: boolean;
    deliveryRequested: boolean;
  };

  // Pricing / fee inputs
  displayUnitPricePerKg: number; // α込み単価
  guttingPricePerKg: number;
  betaRate: number;
  deliveryMin: number;
  deliveryMax: number;
  freeDeliveryMinKg: number | null;

  // labels（t() 渡し）
  labels: {
    quantityKg: string;
    sizeRequestText: string;
    requestedDateLabel: string;
    today: string;
    tomorrow: string;
    dayAfterTomorrow: string;
    pickDate: string;
    orPickFromCalendar: string;
    timeBand: string;
    timeDetail: string;
    memo: string;
    guttingRequested: string;
    deliveryRequested: string;
    submit: string;

    // estimate labels
    estimateTitle: string;
    estimateFish: string;
    estimateGutting: string;
    estimateSupport: string;
    estimateDelivery: string;
    estimateTotal: string;
    estimateNote: string;
    freeDeliveryHint: string;
  };

  // options labels
  timeBandOptions: {
    morning: string;
    afternoon: string;
    night: string;
  };

  // server action
  createOrderAction: (formData: FormData) => void;
};

export default function OrderFormClient(props: Props) {
  const {
    listingId,
    todayDate,
    guttingAvailable,
    deliveryAvailable,
    tiersLabel,
    defaultValues,
    displayUnitPricePerKg,
    guttingPricePerKg,
    betaRate,
    deliveryMin,
    deliveryMax,
    freeDeliveryMinKg,
    labels,
    timeBandOptions,
    createOrderAction
  } = props;

  const [quantityKg, setQuantityKg] = useState<number>(Number(defaultValues.quantityKg || 0));
  const [guttingRequested, setGuttingRequested] = useState<boolean>(defaultValues.guttingRequested);
  const [deliveryRequested, setDeliveryRequested] = useState<boolean>(defaultValues.deliveryRequested);

  // 数量が空になったときに NaN にならないように
  const quantitySafe = useMemo(() => (Number.isFinite(quantityKg) ? quantityKg : 0), [quantityKg]);

  return (
    <form action={createOrderAction}>
      <input type="hidden" name="listingId" value={listingId} />

      <label>
        {labels.quantityKg}
        <input
          name="quantityKg"
          type="number"
          step="0.1"
          required
          defaultValue={defaultValues.quantityKg}
          onChange={(e) => setQuantityKg(Number(e.target.value))}
        />
      </label>

      <label>
        {labels.sizeRequestText}
        <input name="sizeRequestText" required defaultValue={defaultValues.sizeRequestText} />
      </label>

      <label>
        {labels.requestedDateLabel}
        <select name="dayOffset" required defaultValue="0">
          <option value="0">{labels.today}</option>
          <option value="1">{labels.tomorrow}</option>
          <option value="2">{labels.dayAfterTomorrow}</option>
        </select>
      </label>

      <details>
        <summary>{labels.pickDate}</summary>
        <label>
          {labels.orPickFromCalendar}
          <input type="date" name="selectedDate" min={todayDate ?? ''} />
        </label>
      </details>

      <label>
        {labels.timeBand}
        <select name="timeBand" required defaultValue={defaultValues.timeBand}>
          <option value="" disabled>
            --
          </option>
          <option value="MORNING">{timeBandOptions.morning}</option>
          <option value="AFTERNOON">{timeBandOptions.afternoon}</option>
          <option value="NIGHT">{timeBandOptions.night}</option>
        </select>
      </label>

      <label>
        {labels.timeDetail}
        <input name="timeDetail" defaultValue={defaultValues.timeDetail} />
      </label>

      <label>
        {labels.memo}
        <textarea name="memo" defaultValue={defaultValues.memo} />
      </label>

      {guttingAvailable ? (
        <label>
          {labels.guttingRequested}
          <input
            name="guttingRequested"
            type="checkbox"
            defaultChecked={defaultValues.guttingRequested}
            onChange={(e) => setGuttingRequested(e.target.checked)}
          />
        </label>
      ) : null}

      {deliveryAvailable ? (
        <label>
          {labels.deliveryRequested}
          <input
            name="deliveryRequested"
            type="checkbox"
            defaultChecked={defaultValues.deliveryRequested}
            onChange={(e) => setDeliveryRequested(e.target.checked)}
          />
        </label>
      ) : null}

      <p className="muted" style={{marginTop: 8}}>
        ※ 配送費は農家との距離帯により決まります（注文後、農家が距離帯を選択します）
      </p>
      {/* ここがリアルタイム概算（内訳＋合計レンジ） */}
      <OrderEstimate
        quantityKg={quantitySafe}
        displayUnitPricePerKg={displayUnitPricePerKg}
        guttingRequested={guttingRequested && guttingAvailable}
        guttingPricePerKg={guttingPricePerKg}
        betaRate={betaRate}
        deliveryRequested={deliveryRequested && deliveryAvailable}
        deliveryMin={deliveryMin}
        deliveryMax={deliveryMax}
        freeDeliveryMinKg={freeDeliveryMinKg}
        labels={{
          title: labels.estimateTitle,
          fish: labels.estimateFish,
          gutting: labels.estimateGutting,
          support: labels.estimateSupport,
          delivery: labels.estimateDelivery,
          total: labels.estimateTotal,
          note: labels.estimateNote,
          freeDeliveryHint: labels.freeDeliveryHint
        }}
      />

      {/* 参考として配送レンジの原文も残したいなら、下を出す（不要なら消してOK） */}
      <div className="muted" style={{marginTop: 8}}>
        {labels.estimateDelivery}: {tiersLabel}
      </div>

      <button type="submit">{labels.submit}</button>
    </form>
  );
}