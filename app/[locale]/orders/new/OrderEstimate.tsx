'use client';

import {useMemo} from 'react';
import {formatMoneyKHR} from '../../../../lib/formatMoneyKHR';

type Props = {
  quantityKg: number;
  displayUnitPricePerKg: number; // α込み単価
  guttingRequested: boolean;
  guttingPricePerKg: number;
  betaRate: number;
  deliveryRequested: boolean;
  deliveryMin: number;
  deliveryMax: number;
  freeDeliveryMinKg: number | null;
  labels: {
    title: string;
    fish: string;
    gutting: string;
    support: string;
    delivery: string;
    total: string;
    note: string;
    freeDeliveryHint: string; // "{minKg}" を含む
  };
};

function money(n: number) {
  return formatMoneyKHR(Number.isFinite(n) ? n : 0);
}

export default function OrderEstimate(props: Props) {
  const {
    quantityKg,
    displayUnitPricePerKg,
    guttingRequested,
    guttingPricePerKg,
    betaRate,
    deliveryRequested,
    deliveryMin,
    deliveryMax,
    freeDeliveryMinKg,
    labels
  } = props;

  const calc = useMemo(() => {
    const qty = Number.isFinite(quantityKg) ? quantityKg : 0;

    const fishSubtotal = qty * displayUnitPricePerKg;
    const guttingFee = guttingRequested ? qty * guttingPricePerKg : 0;

    // βは魚代小計に対して
    const supportFee = fishSubtotal * betaRate;

    // 配送費：配送希望ONのときだけレンジ（送料無料条件も考慮）
    let dMin = 0;
    let dMax = 0;

    if (deliveryRequested) {
      const eligibleFree = freeDeliveryMinKg != null && qty >= freeDeliveryMinKg;
      if (eligibleFree) {
        dMin = 0;
        dMax = 0;
      } else {
        dMin = deliveryMin;
        dMax = deliveryMax;
      }
    }

    const totalMin = fishSubtotal + guttingFee + supportFee + dMin;
    const totalMax = fishSubtotal + guttingFee + supportFee + dMax;

    return {fishSubtotal, guttingFee, supportFee, dMin, dMax, totalMin, totalMax};
  }, [
    quantityKg,
    displayUnitPricePerKg,
    guttingRequested,
    guttingPricePerKg,
    betaRate,
    deliveryRequested,
    deliveryMin,
    deliveryMax,
    freeDeliveryMinKg
  ]);

  const showRange = deliveryRequested && calc.dMin !== calc.dMax;

  return (
    <div className="notice">
      <strong>{labels.title}</strong>

      <div className="muted">
        {labels.fish}: {money(calc.fishSubtotal)}
      </div>

      {guttingRequested ? (
        <div className="muted">
          {labels.gutting}: {money(calc.guttingFee)}
        </div>
      ) : null}

      <div className="muted">
        {labels.support}: {money(calc.supportFee)}
      </div>

      <div className="muted">
        {labels.delivery}:{' '}
        {deliveryRequested ? (
          freeDeliveryMinKg != null && quantityKg >= freeDeliveryMinKg ? (
            <>
              {money(0)}{' '}
              <span className="muted">
                ({labels.freeDeliveryHint.replace('{minKg}', String(freeDeliveryMinKg))})
              </span>
            </>
          ) : showRange ? (
            `${money(calc.dMin)} - ${money(calc.dMax)}`
          ) : (
            money(calc.dMin)
          )
        ) : (
          money(0)
        )}
      </div>

      <div style={{marginTop: 8}}>
        <strong>
          {labels.total}: {showRange ? `${money(calc.totalMin)} - ${money(calc.totalMax)}` : money(calc.totalMin)}
        </strong>
      </div>

      <div className="muted" style={{marginTop: 6}}>
        {labels.note}
      </div>
    </div>
  );
}
