import { CareLevel, CoverageSummary } from '../types';
import { resolveCarrierPlan } from '../data/insurance-plans';
import { syntheticPricing } from '../data/synthetic-pricing';

export interface EligibilityParams {
  careLevel?: CareLevel;
  payerKey?: string;
  planId?: string;
  memberId?: string;
}

export function checkEligibility(params: EligibilityParams): CoverageSummary {
  const careLevel: CareLevel = params.careLevel || 'primary_care';

  // Base cost lookup from synthetic pricing
  const baseCostLookup = {
    self_care: syntheticPricing.baseCosts.self_care || { min: 0, max: 20 },
    telehealth: syntheticPricing.baseCosts.telehealth,
    primary_care: syntheticPricing.baseCosts.primary_care,
    urgent_care: syntheticPricing.baseCosts.urgent_care,
    emergency_room: syntheticPricing.baseCosts.emergency_room,
  };
  const base = baseCostLookup[careLevel] || { min: 35, max: 120 };

  // Explicit Self-Pay check
  if (params.payerKey === 'NONE' || params.payerKey === 'SELF_PAY' || !params.payerKey) {
    const formattedCareLevel = careLevel.replace('_', ' ');
    return {
      source: 'synthetic',
      payer: 'Self-pay',
      plan_status: 'Uninsured / Self-Pay',
      copay: null,
      coinsurance_percent: 100,
      deductible_remaining: 0,
      estimated_visit_cost: { min: base.min, max: base.max },
      spoken_summary: `Your visit is self-pay. Expect roughly $${base.min}–$${base.max} out of pocket for a ${formattedCareLevel} visit.`,
    };
  }

  // Insured plan resolution
  const { carrier, plan } = resolveCarrierPlan(params.payerKey, params.planId);
  const displayName = `${carrier.name} ${plan.name}`;
  const planStatus = 'Active Coverage';

  // Copay determination
  let copay: number | null = null;
  if (careLevel === 'self_care') {
    copay = plan.copays.telehealth;
  } else {
    copay = plan.copays[careLevel] ?? null;
  }

  const deductible = plan.deductibleRemaining;
  const coinsurance = plan.coinsurancePct;

  // Calculation per spec 7.1
  let estMin: number;
  let estMax: number;

  if (copay !== null && (deductible === 0 || deductible === undefined)) {
    estMin = copay;
    estMax = copay;
  } else {
    const pct = coinsurance > 0 ? coinsurance / 100 : 1;
    const cappedDeductible = deductible > 0 ? deductible : base.min;
    estMin = Math.round(Math.min(base.min, cappedDeductible) * pct) || base.min;
    estMax = Math.round(base.max);
  }

  const formattedCareLevel = careLevel.replace('_', ' ');
  const spoken_summary =
    `Your ${displayName} plan shows ${planStatus.toLowerCase()}. ` +
    (copay !== null
      ? `Expect roughly a $${copay} copay`
      : `Expect roughly $${estMin}–$${estMax} out of pocket`) +
    ` for a ${formattedCareLevel} visit.`;

  return {
    source: 'synthetic',
    payer: displayName,
    plan_status: planStatus,
    copay,
    coinsurance_percent: coinsurance,
    deductible_remaining: deductible > 0 ? deductible : undefined,
    estimated_visit_cost: { min: estMin, max: estMax },
    spoken_summary,
  };
}
