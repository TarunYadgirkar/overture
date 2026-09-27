export interface SyntheticPricingData {
  plans: Record<
    string,
    {
      name: string;
      deductibleRemaining: number;
      telehealthCopay: number;
      pcpCopay: number;
      urgentCareCopay: number;
      erCopay: number;
      coinsuranceAfterDeductible: number;
    }
  >;
  baseCosts: {
    self_care?: { min: number; max: number };
    telehealth: { min: number; max: number };
    primary_care: { min: number; max: number };
    urgent_care: { min: number; max: number };
    emergency_room: { min: number; max: number };
  };
}

export const syntheticPricing: SyntheticPricingData = {
  plans: {
    "BlueShield Silver PPO": {
      name: "BlueShield Silver PPO (synthetic)",
      deductibleRemaining: 420,
      telehealthCopay: 20,
      pcpCopay: 35,
      urgentCareCopay: 85,
      erCopay: 350,
      coinsuranceAfterDeductible: 0.2,
    },
    "Aetna Bronze HMO": {
      name: "Aetna Bronze HMO (synthetic)",
      deductibleRemaining: 2800,
      telehealthCopay: 40,
      pcpCopay: 60,
      urgentCareCopay: 120,
      erCopay: 750,
      coinsuranceAfterDeductible: 0.3,
    },
    "Kaiser Gold HMO": {
      name: "Kaiser Gold HMO (synthetic)",
      deductibleRemaining: 0,
      telehealthCopay: 10,
      pcpCopay: 20,
      urgentCareCopay: 40,
      erCopay: 150,
      coinsuranceAfterDeductible: 0.1,
    },
    "Uninsured / Self-Pay": {
      name: "Uninsured / Self-Pay (synthetic)",
      deductibleRemaining: 0,
      telehealthCopay: 75,
      pcpCopay: 150,
      urgentCareCopay: 250,
      erCopay: 1500,
      coinsuranceAfterDeductible: 1.0,
    },
  },
  baseCosts: {
    self_care: { min: 0, max: 20 },
    telehealth: { min: 20, max: 40 },
    primary_care: { min: 35, max: 120 },
    urgent_care: { min: 85, max: 180 },
    emergency_room: { min: 650, max: 1200 },
  },
};

export const DEFAULT_PLAN_KEY = "BlueShield Silver PPO";
