import raw from "./who/who-data.json";

export type Indicator = "wfa" | "lfa" | "hcfa";
type Table = Record<"male" | "female", number[][]>;

const data = raw as unknown as Record<Indicator, Table>;

export function ageInDays(dob: string, at: Date) {
  const birth = new Date(`${dob}T12:00:00Z`);
  return Math.max(0, Math.floor((at.getTime() - birth.getTime()) / 86_400_000));
}

function rowFor(indicator: Indicator, sex: "male" | "female", ageDays: number) {
  const table = data[indicator][sex];
  const index = Math.min(Math.max(ageDays, 0), table.length - 1);
  return table[index];
}

function avgLms(indicator: Indicator, sex: string, ageDays: number) {
  if (sex === "male" || sex === "female") return rowFor(indicator, sex, ageDays);
  const male = rowFor(indicator, "male", ageDays);
  const female = rowFor(indicator, "female", ageDays);
  return [male[0], (male[1] + female[1]) / 2, (male[2] + female[2]) / 2, (male[3] + female[3]) / 2];
}

export function zScore(indicator: Indicator, sex: string, ageDays: number, value: number) {
  const [, L, M, S] = avgLms(indicator, sex, ageDays);
  if (!M || !S) return 0;
  if (Math.abs(L) < 1e-9) return Math.log(value / M) / S;
  return (Math.pow(value / M, L) - 1) / (L * S);
}

function erf(x: number) {
  const sign = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-a * a);
  return sign * y;
}

export function normalCdf(z: number) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function percentile(indicator: Indicator, sex: string, ageDays: number, value: number) {
  const z = zScore(indicator, sex, ageDays, value);
  const p = normalCdf(z) * 100;
  return Math.min(99.9, Math.max(0.1, p));
}

export function valueAtZ(indicator: Indicator, sex: string, ageDays: number, z: number) {
  const [, L, M, S] = avgLms(indicator, sex, ageDays);
  if (Math.abs(L) < 1e-9) return M * Math.exp(S * z);
  return M * Math.pow(1 + L * S * z, 1 / L);
}

export const zBands = {
  p3: -1.880793608151251,
  p15: -1.036433389493789,
  p50: 0,
  p85: 1.036433389493789,
  p97: 1.880793608151251,
};

export type GrowthPoint = {
  ageDays: number;
  ageLabel: string;
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
};

/** WHO percentile bands, sampled every 15 days up to maxAgeDays (max 5 years). */
export function bandsFor(
  indicator: Indicator,
  sex: string,
  maxAgeDays: number,
  stepDays = 15,
): GrowthPoint[] {
  const max = Math.min(Math.max(maxAgeDays, 30), 1825);
  const points: GrowthPoint[] = [];
  for (let day = 0; day <= max; day += stepDays) {
    points.push({
      ageDays: day,
      ageLabel: `${Math.round(day / 30.4375)}m`,
      p3: Number(valueAtZ(indicator, sex, day, zBands.p3).toFixed(3)),
      p15: Number(valueAtZ(indicator, sex, day, zBands.p15).toFixed(3)),
      p50: Number(valueAtZ(indicator, sex, day, zBands.p50).toFixed(3)),
      p85: Number(valueAtZ(indicator, sex, day, zBands.p85).toFixed(3)),
      p97: Number(valueAtZ(indicator, sex, day, zBands.p97).toFixed(3)),
    });
  }
  return points;
}

export function measurementValue(indicator: Indicator, row: Record<string, unknown>) {
  if (indicator === "wfa") return row.weight_g ? Number(row.weight_g) / 1000 : null;
  if (indicator === "lfa") return row.height_cm ? Number(row.height_cm) : null;
  return row.head_circumference_cm ? Number(row.head_circumference_cm) : null;
}
