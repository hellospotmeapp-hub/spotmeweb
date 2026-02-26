import { Need } from './data';

export interface SplitAllocation {
  needId: string;
  needTitle: string;
  userName: string;
  userAvatar: string;
  userCity: string;
  category: string;
  amount: number;
  goalAmount: number;
  raisedBefore: number;
  raisedAfter: number;
  willComplete: boolean;
  remaining: number;
}

export interface SplitResult {
  allocations: SplitAllocation[];
  totalAmount: number;
  totalPeople: number;
  goalsCompleted: number;
  fee: number;
  netAmount: number;
}

export type SpreadMode = 'closest' | 'category' | 'random';

/**
 * Smart Split Algorithm
 * 
 * Given a total amount, distributes money across needs to maximize
 * the number of goals completed. Uses a greedy approach:
 * 1. Sort needs by remaining amount (ascending)
 * 2. Fill needs that can be completed first
 * 3. Distribute remainder to the next closest need
 */
export function smartSplit(
  totalAmount: number,
  needs: Need[],
  mode: SpreadMode,
  category?: string,
  specificNeedIds?: string[],
): SplitResult {
  // Filter to only collecting needs
  let eligibleNeeds = needs.filter(n => n.status === 'Collecting');

  // Apply mode-specific filtering
  if (mode === 'category' && category) {
    eligibleNeeds = eligibleNeeds.filter(n => n.category === category);
  }

  if (specificNeedIds && specificNeedIds.length > 0) {
    eligibleNeeds = eligibleNeeds.filter(n => specificNeedIds.includes(n.id));
  }

  if (eligibleNeeds.length === 0) {
    return {
      allocations: [],
      totalAmount,
      totalPeople: 0,
      goalsCompleted: 0,
      fee: 0,
      netAmount: totalAmount,
    };
  }


  let sortedNeeds: Need[];

  switch (mode) {
    case 'closest':
      // Sort by remaining amount ascending (smallest gap first)
      sortedNeeds = [...eligibleNeeds].sort((a, b) => {
        const remainA = a.goalAmount - a.raisedAmount;
        const remainB = b.goalAmount - b.raisedAmount;
        return remainA - remainB;
      });
      break;

    case 'category':
      // Within category, sort by closest to goal
      sortedNeeds = [...eligibleNeeds].sort((a, b) => {
        const remainA = a.goalAmount - a.raisedAmount;
        const remainB = b.goalAmount - b.raisedAmount;
        return remainA - remainB;
      });
      break;

    case 'random':
      // Shuffle the array
      sortedNeeds = [...eligibleNeeds];
      for (let i = sortedNeeds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [sortedNeeds[i], sortedNeeds[j]] = [sortedNeeds[j], sortedNeeds[i]];
      }
      break;

    default:
      sortedNeeds = [...eligibleNeeds];
  }

  const allocations: SplitAllocation[] = [];
  let remainingBudget = totalAmount;
  let goalsCompleted = 0;

  // Phase 1: Try to complete goals (greedy approach)
  if (mode !== 'random') {
    for (const need of sortedNeeds) {
      if (remainingBudget <= 0) break;

      const needRemaining = need.goalAmount - need.raisedAmount;

      if (needRemaining <= remainingBudget && needRemaining > 0) {
        // We can complete this goal!
        const allocation = Math.round(needRemaining * 100) / 100;
        allocations.push({
          needId: need.id,
          needTitle: need.title,
          userName: need.userName,
          userAvatar: need.userAvatar,
          userCity: need.userCity,
          category: need.category,
          amount: allocation,
          goalAmount: need.goalAmount,
          raisedBefore: need.raisedAmount,
          raisedAfter: need.raisedAmount + allocation,
          willComplete: true,
          remaining: needRemaining,
        });
        remainingBudget = Math.round((remainingBudget - allocation) * 100) / 100;
        goalsCompleted++;
      }
    }

    // Phase 2: Distribute remaining budget to the next need that wasn't fully funded
    if (remainingBudget > 0) {
      const unfundedNeeds = sortedNeeds.filter(
        n => !allocations.find(a => a.needId === n.id)
      );

      if (unfundedNeeds.length > 0) {
        const nextNeed = unfundedNeeds[0];
        const needRemaining = nextNeed.goalAmount - nextNeed.raisedAmount;
        const allocation = Math.min(remainingBudget, needRemaining);
        const roundedAllocation = Math.round(allocation * 100) / 100;

        if (roundedAllocation > 0) {
          allocations.push({
            needId: nextNeed.id,
            needTitle: nextNeed.title,
            userName: nextNeed.userName,
            userAvatar: nextNeed.userAvatar,
            userCity: nextNeed.userCity,
            category: nextNeed.category,
            amount: roundedAllocation,
            goalAmount: nextNeed.goalAmount,
            raisedBefore: nextNeed.raisedAmount,
            raisedAfter: nextNeed.raisedAmount + roundedAllocation,
            willComplete: roundedAllocation >= needRemaining,
            remaining: needRemaining,
          });
          remainingBudget = Math.round((remainingBudget - roundedAllocation) * 100) / 100;
          if (roundedAllocation >= needRemaining) goalsCompleted++;
        }
      }
    }
  } else {
    // Random mode: distribute evenly across up to 6 random needs
    const maxNeeds = Math.min(sortedNeeds.length, 6);
    const selectedNeeds = sortedNeeds.slice(0, maxNeeds);
    const perNeed = Math.floor((totalAmount / maxNeeds) * 100) / 100;
    let distributed = 0;

    for (let i = 0; i < selectedNeeds.length; i++) {
      const need = selectedNeeds[i];
      const needRemaining = need.goalAmount - need.raisedAmount;
      // Last person gets the remainder to avoid rounding issues
      const isLast = i === selectedNeeds.length - 1;
      const allocation = isLast
        ? Math.round((totalAmount - distributed) * 100) / 100
        : Math.min(perNeed, needRemaining);
      const roundedAllocation = Math.round(allocation * 100) / 100;

      if (roundedAllocation > 0) {
        const willComplete = roundedAllocation >= needRemaining;
        allocations.push({
          needId: need.id,
          needTitle: need.title,
          userName: need.userName,
          userAvatar: need.userAvatar,
          userCity: need.userCity,
          category: need.category,
          amount: roundedAllocation,
          goalAmount: need.goalAmount,
          raisedBefore: need.raisedAmount,
          raisedAfter: need.raisedAmount + roundedAllocation,
          willComplete,
          remaining: needRemaining,
        });
        distributed += roundedAllocation;
        if (willComplete) goalsCompleted++;
      }
    }
    remainingBudget = Math.round((totalAmount - distributed) * 100) / 100;
  }

  const fee = 0; // No platform fee - 100% goes to recipients
  const netAmount = totalAmount;


  return {
    allocations,
    totalAmount,
    totalPeople: allocations.length,
    goalsCompleted,
    fee,
    netAmount,
  };
}

/**
 * Get a summary message for the split
 */
export function getSplitSummary(result: SplitResult): string {
  if (result.allocations.length === 0) {
    return 'No eligible needs found for this spread.';
  }

  const parts: string[] = [];
  parts.push(`$${result.totalAmount} spread across ${result.totalPeople} ${result.totalPeople === 1 ? 'person' : 'people'}`);

  if (result.goalsCompleted > 0) {
    parts.push(`completing ${result.goalsCompleted} ${result.goalsCompleted === 1 ? 'goal' : 'goals'}`);
  }

  return parts.join(', ');
}

/**
 * Get an emotional message based on the impact
 */
export function getImpactMessage(result: SplitResult): string {
  if (result.goalsCompleted >= 3) {
    return "You're changing lives today. Three or more goals completed in one act of kindness.";
  }
  if (result.goalsCompleted >= 2) {
    return "Two goals completed! Your generosity just made two people's day.";
  }
  if (result.goalsCompleted === 1) {
    return "You just helped someone reach their goal. That's the power of community.";
  }
  if (result.totalPeople >= 4) {
    return "Your love is spreading far and wide. Multiple people feel your kindness today.";
  }
  if (result.totalPeople >= 2) {
    return "You're making a difference for multiple people at once. That's beautiful.";
  }
  return "Every dollar counts. You're part of something bigger.";
}
