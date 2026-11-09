import type { RequestHandler } from 'express';
import { ProblemError, sendProblem } from './problem.js';
import type { Session } from './session.js';

export type Plan = 'plus';
export type UserPlan = 'free' | Plan;

// Reads the user's plan from the database (ADR-0025).
export type PlanReader = (userId: string) => Promise<UserPlan>;

// After requireSession. The plan is read on every request and never taken from the client or
// the JWT (ADR-0025, S10), so a refund takes Plus away at once.
export function requirePlan(plan: Plan, planOf: PlanReader | undefined): RequestHandler {
  return async (_request, response, next) => {
    if (!planOf) {
      sendProblem(response, new ProblemError(503, 'plan.unavailable', 'Plans are not available'));
      return;
    }
    const session: Session | undefined = response.locals.session;
    if (!session || (await planOf(session.userId)) !== plan) {
      sendProblem(response, new ProblemError(403, 'plan.plus_required', 'This needs Plus'));
      return;
    }
    next();
  };
}
