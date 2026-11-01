export interface CopyPlan {
  copies: number;
}

export interface CollatedPrintRun<T extends CopyPlan> {
  plan: T;
  copyNumber: number;
}

export function buildCollatedPrintRuns<T extends CopyPlan>(plans: T[]): CollatedPrintRun<T>[] {
  const maxCopies = plans.reduce((maximum, plan) => Math.max(maximum, Math.floor(plan.copies)), 0);
  const runs: CollatedPrintRun<T>[] = [];

  for (let copyNumber = 1; copyNumber <= maxCopies; copyNumber += 1) {
    for (const plan of plans) {
      if (Math.floor(plan.copies) >= copyNumber) {
        runs.push({ plan, copyNumber });
      }
    }
  }

  return runs;
}
