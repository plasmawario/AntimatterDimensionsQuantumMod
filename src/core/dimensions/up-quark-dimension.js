import { DC } from "../constants";
import { Currency } from "../currency";
import { FermionUpgrade, ElectronUpgrade } from "../fermions";
import { FusionUpgrade } from "../fusion";
import { FusionChallenge } from "../fusion-challenges";
import { GenBoostDown } from "../genboostDown";
import { GenBoostUp } from "../genboostUp";
import { fusionReset } from "../nuclear-fusion";
import { PlayerProgress } from "../player-progress";
import { fusionChallenges } from "../secret-formula/challenges/fusion-challenges";
import { Tickspeed_Quantum } from "../tickspeed_quantum";

import { DimensionState } from "./dimensionTriple";

/***
 * Do additional logic when we buy a dimension
 */
function onBuyDimension(tier) {
  if (tier === 1) TutorialQuantum.turnOffEffect(TUTORIAL_QUANTUM_STATE.UP);
}

/***
 * This will buy a single quark generator
 * @param {number} tier The nth dimension to buy
 * @returns {boolean} whether or not the purchase was successful
 */
export function buySingleUpQuarkGenerator(tier) {
  const dim = UpQuarkGenerator(tier);

  //cancel buying generator if we cannot afford it or if it is locked
  if (Currency.quarks1.lt(dim.cost) || !dim.isUnlocked) return false;

  //achievement handling
  QuantumAchievement(9 + (tier * 2)).unlock();
  if (tier === 3) QuantumAchievement(37).tryUnlock();

  Currency.quarks1.subtract(dim.cost);

  //note that "amount" and "bought" are different values. This means we can have a multiplier
  //based on how many we actually bought, and not how many were generated by, say, a dimension
  dim.amount = dim.amount.plus(1);
  dim.bought += 1;

  //dim.cost = dim.nextCost(dim.bought);

  //challenge stuff  
  if (FusionChallenge(3).isRunning) {
    resetDownQuarkGenerator();
    resetElectronGenerator();
  }

  onBuyDimension(tier);
  return true;
}

/***
 * This will reset your quark generators to their base amount that you have already bought
 */
export function resetUpQuarkGenerator() {
  for (const dim of UpQuarkGenerators.all) dim.amount = new Decimal(dim.bought);
  //updateUpQuarkGeneratorCosts();
}

/***
 * This will completely reset your quark generators to nothing
 */
export function fullResetUpQuarkGenerator() {
  for (const dim of UpQuarkGenerators.all) {
    dim.cost = new Decimal(dim.baseCost);
    dim.amount = DC.D0;
    dim.bought = 0;
  }
}

/***
 * This will toggle the autobuyer settings of all your quark generators
 */
export function toggleAllUpQuarkGeneratorsDims() {
  const areEnabled = Autobuyer.upQuarkGenerator(1).isActive;
  for (let i = 1; i < 4; i++) {
    Autobuyer.upQuarkGenerator(i).isActive = !areEnabled;
  }
}

/***
 * This will buy max your specified quark generator
 * @param {number} tier The nth dimension to buy max
 * @param {number} portionToSpend how much of your current quarks you are willing to spend (Default: 1)
 * @returns {boolean} whether or not the purchase was successful
 */
export function buyMaxUpQuarkGenerator(tier, bulk = Infinity) {

  /**
   * This block of code is the old algorithm taken from the time dimension logic. It appears to work
   * fine, but it breaks when we reach the post-fusion cost scaling, causing prices to jump to
   * absurd amounts, clearly not intentioned. It has been replaced with the logic below, which
   * is taken from the tickspeed buy max logic. It seems to work with our post-fusion cost scaling
   * when using buy max, though i am skeptical that it's a perfect replacement. For now, i'll
   * keep this block here just in case, but so far this logic replacement seems to work fine.
   */

  /*const canSpend = Currency.quarks1.value.times(portionToSpend);
  const dim = UpQuarkGenerator(tier);
  if (canSpend.lt(dim.cost) || !dim.isUnlocked) return false;
  
  const bulk = bulkBuyBinarySearch(canSpend, {
    costFunction: bought => dim.nextCost(bought),
    cumulative: true,
    firstCost: dim.cost,
  }, dim.bought);

  if (!bulk) return false;
  
  Currency.quarks1.subtract(bulk.purchasePrice);
  dim.amount = dim.amount.plus(bulk.quantity);
  dim.bought += bulk.quantity;
  dim.cost = dim.nextCost(dim.bought);*/

  const dim = UpQuarkGenerator(tier);
  if (!dim.isAffordable || !dim.isUnlocked) return false;

  //get how many times we can purchase these generators
  const purchases = dim.costScale.getMaxBought(dim.bought, Currency.quarks1.value, 1, 1, bulk);
  
  //if we cannot purchase any, return
  if (purchases === null) {
      return;
  }

  Currency.quarks1.subtract(Decimal.pow10(purchases.logPrice));
  dim.bought += purchases.quantity;
  dim.amount = dim.amount.plus(purchases.quantity);

  //challenge stuff  
  if (FusionChallenge(3).isRunning) {
    resetDownQuarkGenerator();
    resetElectronGenerator();
  }

  return true;
}

/***
 * This will buy max your all quark generators
 */
export function maxAllUpQuarkGenerator() {
  // Try to buy single from the highest affordable new dimensions
  for (let i = 3; i > 0 && UpQuarkGenerator(i).bought === 0; i--) {
    buySingleUpQuarkGenerator(i);
    //buySingleUpQuarkGenerator(i, true);
  }

  // Buy everything costing less than 1% of initial Quarks
  for (let i = 3; i > 0; i--) {
    buyMaxUpQuarkGenerator(i);
    //buyMaxUpQuarkGenerator(i, 0.01, true);
  }

  // Loop buying the cheapest dimension possible; explicit infinite loops make me nervous
  const unlockedDimensions = UpQuarkGenerators.all.filter(d => d.isUnlocked);

  //for some reason autobuyers will try and buy max dimensions when they haven't been
  //registered as unlocked yet, causing an error when reducing an empty array. This
  //check should prevent that. The down-type generators already have this
  //check
  if (unlockedDimensions.length > 0){
    for (let stop = 0; stop < 1000; stop++) {
      const cheapestDim = unlockedDimensions.reduce((a, b) => (b.cost.gte(a.cost) ? a : b));
      if (!buySingleUpQuarkGenerator(cheapestDim.tier, true)) break;
    }
  }
}

/***
 * This determine the multiplier of your quark generators
 * @returns {Decimal} the resulting multiplier
 */
export function upQuarkGeneratorCommonMultiplier() {
  /*let mult = new Decimal(ShopPurchase.allDimPurchases.currentMult);
  return mult;*/

  let multi = DC.D2;

  //achievements make these stronger
  multi = multi.times(QuantumAchievements.power);

  return multi;
}

/***
 * This will simply update the costs for your quark generators
 */
/*export function updateUpQuarkGeneratorCosts() {
  for (let i = 1; i <= 3; i++) {
    const dim = UpQuarkGenerator(i);
    dim.cost = dim.nextCost(dim.bought);
  }
}*/

/***
 * This is the class that contains information related to quark generators, along with a
 * constructor and functions
 */
class UpQuarkGeneratorState extends DimensionState {
  constructor(tier) {
    super(() => player.dimensions.upQuarks, tier);
    //original base costs: e1, e4, e12
    const BASE_COSTS = [null, DC.E1, DC.E3, DC.E7];      //these are apparently instead set in player
    this._baseCost = BASE_COSTS[tier];
    //original base costs: 1.5, 4, 16
    const COST_MULTS = [null, 1.5, 3, 12];
    this._costMultiplier = COST_MULTS[tier];
    const FC6_COST_MULTS = [null, 1.65, 3.15, 12.15];
    this._FC6_costMultiplier = FC6_COST_MULTS[tier];
    const FC8_COST_MULTS = [null, 1.4, 2.9, 11.9];
    this._FC8_costMultiplier = FC8_COST_MULTS[tier];
    const POSTINF_COST_MULTIPLIERS = [null, 10, 10, 10];
    this._postinfCostMultiplier = POSTINF_COST_MULTIPLIERS[tier];
  }

  /** @returns {Decimal} */
  get cost() {
    return this.costScale.calculateCost(Math.floor(this.bought));
    //return this.data.cost;
  }

  /** @param {Decimal} value */
  set cost(value) { this.data.cost = value; }

  get costScale() {
    
    //define base cost increase based on challenges
    let costMultiplier = this._costMultiplier;
    if (FusionChallenge(6).isRunning) costMultiplier = this._FC6_costMultiplier;
    if (FusionChallenge(8).isRunning) costMultiplier = this._FC8_costMultiplier;

    return new ExponentialCostScaling({
      baseCost: this._baseCost,
      baseIncrease: costMultiplier,
      costScale: Player.postFusionCostScaleMulti,
      scalingCostThreshold: Number.MAX_VALUE
    });
  }

  /***
  * This will calculate the cost of your next quark generator after buying one
  * @param {number} bought how many generators that have been bought
  * @returns {Decimal} the new calculated cost
  */
  /*nextCost(bought) {
    let base = this.costMultiplier;
    const exponent = bought;
    const cost = Decimal.pow(base, exponent).times(this.baseCost);

    return cost;
  }*/

  /***
  * This will get whether or not we have reached the requirement for unlocking a quark generator
  * and making it visible
  * @returns {boolean} whether the requirement was reached
  */
  get requirementReached() {
    const tier = this._tier;

    //challenge
    if (FusionChallenge(8).isRunning && tier > 1) return;
    
    //we set the requirements a generator of the current tier to be either:
    //if it's the first tier, if we have enough gen boosts to unlock it, or if we've fused at least once
    return tier === 1 || (tier < GenBoostUp.totalBoosts + 2) || UpQuarkGenerator(tier).amount.gte(1) || PlayerProgress.matterUnlocked();
    //return UpQuarkGenerator(tier).cost.equals(Currency.quarks1.value);
  }

  /***
  * This will check to see if the quark generator is unlocked and visible or not, and
  * make it purchaseable
  * @returns {boolean} whether the generator is unlocked and visible
  */
  get isUnlocked() {
    const tier = this._tier;

    //this can only be unlocked after the requirement has been reached. If so,
    //unlock the generator if this is a tier 1, 
    //or if the total amount of quarks made is more than the cost of generator,
    //or you already own a generator of this tier
    return this.requirementReached && 
        ((tier === 1 ||
        (tier === 3 && player.upBoosts >= 2) ||
        (tier === 2 && player.upBoosts >= 1)) &&
        this.isAvailableForPurchase ||
        UpQuarkGenerator(tier).amount.gte(1));
  }

  /***
  * This will check to see if we can buy this quark generator
  * @returns {boolean} whether or not the purchase was successful
  */
  get isAvailableForPurchase() {
    return this.isAffordable;
  }

  /***
  * This will check if we can afford to buy this quark generator
  * @returns {boolean} whether or not the purchase was successful
  */
  get isAffordable() {
    return Currency.quarks1.gte(this.cost);
  }

  /***
  * This will calculate the total multiplier for a generator
  * @returns {Decimal} the new calculated multiplier
  */
  get multiplier() {
    const tier = this._tier;
    const dim = UpQuarkGenerator(tier);
    let mult = dim.baseMultiplier;

    //purchase multiplier
    let purchaseMult = UpQuarkGenerators.generatorPurchaseMultiplier;

    //other multiplier boosts
    mult = mult.timesEffectsOf(
      QuantumAchievement(17),
      QuantumAchievement(27),
      QuantumAchievement(25),
      QuantumAchievement(45)
    );

    //fusion upgrades
    mult = mult.times(FusionUpgrade(7).effectOrDefault(1));
    mult = mult.times(FusionUpgrade2(5).effectOrDefault(1));
    mult = mult.times(FusionUpgrade2(7).effectOrDefault(1));
    mult = mult.times(FusionUpgrade2(8).effectOrDefault(1));
    //fusion upgrades 4, 5, and 6
    if (tier === 3) {
      mult = mult.times(FusionUpgrade(4).effectOrDefault(1));
      mult = mult.timesEffectsOf(QuantumAchievement(37));
    }
    if (tier === 2) mult = mult.times(FusionUpgrade(5).effectOrDefault(1));
    if (tier === 1) mult = mult.times(FusionUpgrade(6).effectOrDefault(1));
    //generator boosts
    if (!FusionChallenge(7).isRunning) mult = mult.times(GenBoostUp.multiplierToNDTier(tier));
    if (FusionUpgrade2(2).canBeApplied) mult = mult.times(GenBoostDown.multiplierToNDTier(tier)).times(0.25);
    //1st Electron upgrade
    mult = mult.times(ElectronUpgrade(1).effectOrDefault(1));
    //multiplier based on how many generators were bought (excluding the ones generated by higher-tier generators)
    mult = mult.times(Decimal.pow(purchaseMult, dim.bought)).clampMin(1);
    //electric charge multiplier
    mult = mult.times(Currency.electricCharge.value.pow(ElectronGenerators.powerConversionRate).max(1));
    //web nodes
    mult = mult.times(WebNode.fusionChallengeQk.effectOrDefault(1));
    mult = mult.times(WebNode.fusionChallengeQk2.effectOrDefault(1));

    //challenge stuff
    if (FusionChallenge(2).isRunning) mult = mult.times(Currency.fc2_production.value);
    if (FusionChallenge(9).isRunning && GenBoostUp.purchasedBoosts != GenBoostDown.purchasedBoosts) mult = mult.pow(0.75);

    /*const upgradeBought = dim.bought;
    mult = mult.times(Decimal.mul(dim.upgradedMultiplier, upgradeBought));*/

    return mult;
  }

  /***
  * This will calculate the production of quarks your generators are producing per second
  * @returns {Decimal} the production of quarks per second
  */
  get productionPerSecond() {
    let production = this.amount.times(this.multiplier);

    //let tickspeed affect our quark generators
    production = production.times(Tickspeed_Quantum.perSecond);

    return production;
  }

  /***
  * This will calculate the rate of change of your quark production
  * @returns {Decimal} the rate of change
  */
  get rateOfChange() {
    const tier = this._tier;

    if (tier == 3){
      return DC.D0;
    }

    const toGain = UpQuarkGenerator(tier + 1).productionPerSecond;
    const current = Decimal.max(this.amount, 1);
    return toGain.times(10).dividedBy(current).times(getGameSpeedupForDisplay());

    //actually we're just gonna output the quark production per second of each generator
    //return UpQuarkGenerator(tier).productionPerSecond.times(getGameSpeedupForDisplay());
    
  }

  /***
  * This will determine if a particular generator is currently producing or not
  * @returns {Decimal} i dunno
  */
  get isProducing() {
    const tier = this.tier;

    return this.amount.gt(0);
  }

  /***
  * This will get the base cost of your generator
  * @returns {boolean} the base cost of your generator
  */
  get baseCost() {
    return this._baseCost;
  }

  /***
  * This will get the cost multiplier of your generator
  * @returns {boolean} the cost multiplier of your generator
  */
  get costMultiplier() {
    return this._costMultiplier;
  }

  /***
  * This will return the base multiplier of your quark generators
  * @returns {Decimal} the base multiplier of your quark generators
  */
  get baseMultiplier() {
    return GameCache.upQuarkGeneratorCommonMultiplier.value;
  }

  get shortDisplayName() {
    const tier = this._tier;
    let genName = "";
    switch (tier){
        case 1:
            genName = "Up";
            break;
        case 2:
            genName = "Charm";
            break;
        case 3:
            genName = "Top";
            break;
    }

    return genName;
  }

  /***
  * This will attempt to unlock a quark generator
  */
  /*tryUnlock() {
    if (this.isUnlocked) return;
    TimeStudy.timeDimension(this._tier).purchase();
  }*/
}

/**
 * @function
 * @param {number} tier
 * @return {UpQuarkGeneratorState}
 */
export const UpQuarkGenerator = UpQuarkGeneratorState.createAccessor();

export const UpQuarkGenerators = {
  /**
   * @type {UpQuarkGeneratorState[]}
   */
  all: UpQuarkGenerator.index.compact(),

  get generatorPurchaseMultiplier() {
    //const tier = this.tier;
    let mult = FusionUpgrade(2).effectOrDefault(DC.D1_2);
    
    //mult = mult.add(ElectronUpgrade(3).effectOrDefault(0));

    return mult;
  },

  canBuy() {
    return true;
  },

  tick(diff) {
    //defines which generator produces other generators
    for (let tier = 3; tier > 1; tier--) {
        UpQuarkGenerator(tier).produceDimensions(UpQuarkGenerator(tier - 1), diff / 10);
    }

    //defines which generator produces currency
    UpQuarkGenerator(1).produceCurrency(Currency.quarks1, diff);
  },
};



/*export function tryUnlockTimeDimensions() {
  if (UpQuarkGenerator(8).isUnlocked) return;
  for (let tier = 5; tier <= 8; ++tier) {
    if (UpQuarkGenerator(tier).isUnlocked) continue;
    UpQuarkGenerator(tier).tryUnlock();
  }
}*/