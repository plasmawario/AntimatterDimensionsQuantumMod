import { DC } from "../constants";
import { Currency } from "../currency";
import { FermionUpgrade, ElectronUpgrade } from "../fermions";
import { FusionUpgrade2 } from "../fusion";
import { FusionChallenge } from "../fusion-challenges";
import { GenBoostDown } from "../genboostDown";
import { PlayerProgress } from "../player-progress";
import { Tickspeed_Quantum } from "../tickspeed_quantum";

import { DimensionState } from "./dimensionTriple";
import { resetElectronGenerator } from "./electron-dimension";

/***
 * Do additional logic when we buy a dimension
 */
function onBuyDimension(tier) {
  if (tier === 1) TutorialQuantum.turnOffEffect(TUTORIAL_QUANTUM_STATE.DOWN);
}

/***
 * This will buy a single quark generator
 * @param {number} tier The nth dimension to buy
 * @returns {boolean} whether or not the purchase was successful
 */
export function buySingleDownQuarkGenerator(tier) {
  const dim = DownQuarkGenerator(tier);

  //cancel buying generator if we cannot afford it or if it is locked
  if (Currency.quarks1.lt(dim.cost) || !dim.isUnlocked) return false;

  //achievement handling
  QuantumAchievement(10 + (tier * 2)).unlock();
  if (tier === 3) QuantumAchievement(37).tryUnlock();

  Currency.quarks1.subtract(dim.cost);

  //note that "amount" and "bought" are different values. This means we can have a multiplier
  //based on how many we actually bought, and not how many were generated by, say, a dimension

  //challenge stuff
  if (FusionChallenge(1).isRunning){
    dim.amount = dim.amount.plus(1);
    dim.bought += 1;
  }else{
    dim.amount = dim.amount.plus(10);
    dim.bought += 10;
  }

  //dim.cost = dim.nextCost(dim.bought);

  //challenge stuff  
  if (FusionChallenge(3).isRunning) {
    resetUpQuarkGenerator();
    resetElectronGenerator();
  }

  onBuyDimension(tier);
  return true;
}

/***
 * This will reset your quark generators to their base amount that you have already bought
 */
export function resetDownQuarkGenerator() {
  for (const dim of DownQuarkGenerators.all) dim.amount = new Decimal(dim.bought);
  //updateDownQuarkGeneratorCosts();
}

/***
 * This will completely reset your quark generators to nothing
 */
export function fullResetDownQuarkGenerator() {
  for (const dim of DownQuarkGenerators.all) {
    dim.cost = new Decimal(dim.baseCost);
    dim.amount = DC.D0;
    dim.bought = 0;
  }
}

/***
 * This will toggle the autobuyer settings of all your quark generators
 */
export function toggleAllDownQuarkGeneratorsDims() {
  const areEnabled = Autobuyer.downQuarkGenerator(1).isActive;
  for (let i = 1; i < 4; i++) {
    Autobuyer.downQuarkGenerator(i).isActive = !areEnabled;
  }
}

/***
 * This will buy max your specified quark generator
 * @param {number} tier The nth dimension to buy max
 * @param {number} portionToSpend i dunno (Default: 1)
 * @returns {boolean} whether or not the purchase was successful
 */
export function buyMaxDownQuarkGenerator(tier, bulk = Infinity) {

  /**
   * This block of code is the old algorithm taken from the time dimension logic. It appears to work
   * fine, but it breaks when we reach the post-fusion cost scaling, causing prices to jump to
   * absurd amounts, clearly not intentioned. It has been replaced with the logic below, which
   * is taken from the tickspeed buy max logic. It seems to work with our post-fusion cost scaling
   * when using buy max, though i am skeptical that it's a perfect replacement. For now, i'll
   * keep this block here just in case, but so far this logic replacement seems to work fine.
   */

  /*const canSpend = Currency.quarks1.value.times(portionToSpend);
  const dim = DownQuarkGenerator(tier);
  if (canSpend.lt(dim.cost) || !dim.isUnlocked) return false;
  
  const bulk = bulkBuyBinarySearch(canSpend, {
    costFunction: bought => FusionChallenge(1).isRunning ? dim.nextCost(bought) : dim.nextCost(10*bought),
    cumulative: true,
    firstCost: dim.cost,
  }, FusionChallenge(1).isRunning ? dim.bought : 10*dim.bought);
  if (!bulk) return false;
  
  Currency.quarks1.subtract(bulk.purchasePrice);
  dim.amount = FusionChallenge(1).isRunning ? dim.amount.plus(bulk.quantity) : dim.amount.plus(10 * bulk.quantity);
  dim.bought += FusionChallenge(1).isRunning ? bulk.quantity : 10 * bulk.quantity;
  dim.cost = dim.nextCost(dim.bought);*/

  const dim = DownQuarkGenerator(tier);
  if (!dim.isAffordable || !dim.isUnlocked) return false;

  const purchases = dim.costScale.getMaxBought(dim.bought, Currency.quarks1.value, 1, 10, bulk);

  //if we cannot purchase any, return
  if (purchases === null) {
      return;
  }

  Currency.quarks1.subtract(Decimal.pow10(purchases.logPrice));
  dim.bought += purchases.quantity;
  dim.amount = dim.amount.plus(purchases.quantity);

  //challenge stuff
  if (FusionChallenge(3).isRunning) {
    resetUpQuarkGenerator();
    resetElectronGenerator();
  }

  return true;
}

/***
 * This will buy max your all quark generators
 */
export function maxAllDownQuarkGenerator() {
  // Try to buy single from the highest affordable new dimensions
  for (let i = 3; i > 0 && DownQuarkGenerator(i).bought === 0; i--) {
    buySingleDownQuarkGenerator(i);
    //buySingleDownQuarkGenerator(i, true);
  }

  // Buy everything costing less than 1% of initial Quarks
  for (let i = 3; i > 0; i--) {
    buyMaxDownQuarkGenerator(i);
    //buyMaxDownQuarkGenerator(i, 0.01, true);
  }

  // Loop buying the cheapest dimension possible; explicit infinite loops make me nervous
  const unlockedDimensions = DownQuarkGenerators.all.filter(d => d.isUnlocked);

  //implement this check just in case the player tries to buy max all when they have
  //not unlocked bottom-type generators yet
  if (unlockedDimensions.length == 0) return;

  for (let stop = 0; stop < 1000; stop++) {
    const cheapestDim = unlockedDimensions.reduce((a, b) => (b.cost.gte(a.cost) ? a : b));
    if (!buySingleDownQuarkGenerator(cheapestDim.tier, true)) break;
  }
}

/***
 * This determine the multiplier of your quark generators
 * @returns {Decimal} the resulting multiplier
 */
export function downQuarkGeneratorCommonMultiplier() {
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
/*export function updateDownQuarkGeneratorCosts() {
  for (let i = 1; i <= 3; i++) {
    const dim = DownQuarkGenerator(i);
    dim.cost = dim.nextCost(dim.bought);
  }
}*/

/***
 * This is the class that contains information related to quark generators, along with a
 * constructor and functions
 */
class DownQuarkGeneratorState extends DimensionState {
  constructor(tier) {
    super(() => player.dimensions.downQuarks, tier);
    //original base costs: e2, e8, e24
    const BASE_COSTS = [null, DC.E2, DC.E5, DC.E12];      //these are apparently instead set in player
    this._baseCost = BASE_COSTS[tier];
    const FC_1_COSTS = [null, DC.E1, DC.E3, DC.E7];
    this._fc1Cost = FC_1_COSTS[tier];
    //original base mults: 1.5, 4, 16
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
      baseCost: FusionChallenge(1).isRunning ? this._fc1Cost : this._baseCost,
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
    const cost = Decimal.pow(base, exponent).times(FusionChallenge(1).isRunning ? this._fc1Cost : this._baseCost);

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
    return (tier === 1 && player.records.totalQuarks.gte(this.cost)) || (tier > 1 && tier < GenBoostDown.totalBoosts + 2) || DownQuarkGenerator(tier).amount.gte(1) || PlayerProgress.matterUnlocked();
    //return DownQuarkGenerator(tier).cost.equals(Currency.quarks1.value);
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
        (tier === 3 && player.downBoosts >= 2) ||
        (tier === 2 && player.downBoosts >= 1)) &&
        this.isAvailableForPurchase ||
        DownQuarkGenerator(tier).amount.gte(1));

    //unlock the generator if this is a tier 1 or if we can afford th enext tier of generator
    //return (tier == 1 && UpQuarkGenerator(1).bought >= 5) || (tier > 1 && player.records.totalQuarks.gte(this.cost)) || DownQuarkGenerator(tier).amount.gte(1);
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
    const dim = DownQuarkGenerator(tier);
    let mult = dim.baseMultiplier;

    //purchase multiplier
    let purchaseMult = DownQuarkGenerators.generatorPurchaseMultiplier;

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
    if (tier === 3){ 
      mult = mult.times(FusionUpgrade(4).effectOrDefault(1));
      mult = mult.timesEffectsOf(QuantumAchievement(37));
    }
    if (tier === 2) mult = mult.times(FusionUpgrade(5).effectOrDefault(1));
    if (tier === 1) mult = mult.times(FusionUpgrade(6).effectOrDefault(1));
    //apply multiplier from generator boosts
    if (!FusionChallenge(7).isRunning) mult = mult.times(GenBoostDown.multiplierToNDTier(tier));
    if (FusionUpgrade2(1).canBeApplied) mult = mult.times(GenBoostUp.multiplierToNDTier(tier)).times(0.25);
    //apply multiplier of the 2nd Electron upgrade
    mult = mult.times(ElectronUpgrade(2).effectOrDefault(1));
    //apply multiplier based on how many generators were bought (excluding the ones generated by higher-tier generators)
    mult = mult.times(Decimal.pow(purchaseMult, dim.bought)).clampMin(1);
    //electric charge multiplier
    mult = mult.times(Currency.electricCharge.value.pow(ElectronGenerators.powerConversionRate).max(1));
    //web nodes
    mult = mult.times(WebNode.fusionChallengeQk.effectOrDefault(1));
    mult = mult.times(WebNode.fusionChallengeQk2.effectOrDefault(1));

    //fusion challenge 2
    if (FusionChallenge(2).isRunning) mult = mult.times(Currency.fc2_production.value).clampMin(1);
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

    const toGain = DownQuarkGenerator(tier + 1).productionPerSecond;
    const current = Decimal.max(this.amount, 1);
    return toGain.times(10).dividedBy(current).times(getGameSpeedupForDisplay());

    //actually we're just gonna output the quark production per second of each generator
    //return DownQuarkGenerator(tier).productionPerSecond.times(getGameSpeedupForDisplay());
    
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
    return GameCache.downQuarkGeneratorCommonMultiplier.value;
  }

  get shortDisplayName() {
    const tier = this._tier;
    let genName = "";
    switch (tier){
        case 1:
            genName = "Down";
            break;
        case 2:
            genName = "Strange";
            break;
        case 3:
            genName = "Bottom";
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
 * @return {DownQuarkGeneratorState}
 */
export const DownQuarkGenerator = DownQuarkGeneratorState.createAccessor();

export const DownQuarkGenerators = {
  /**
   * @type {DownQuarkGeneratorState[]}
   */
  all: DownQuarkGenerator.index.compact(),

  get generatorPurchaseMultiplier() {
    //const tier = this.tier;
    let mult = FusionUpgrade(3).effectOrDefault(DC.D1_2);
    
    //mult = mult.add(ElectronUpgrade(3).effectOrDefault(0));

    return mult;
  },

  canBuy() {
    return true;
  },

  tick(diff) {
    //defines which generator produces other generators
    for (let tier = 3; tier > 1; tier--) {
        DownQuarkGenerator(tier).produceDimensions(DownQuarkGenerator(tier - 1), diff / 10);
    }

    //defines which generator produces currency
    DownQuarkGenerator(1).produceCurrency(Currency.quarks1, diff);
  },
};



/*export function tryUnlockTimeDimensions() {
  if (DownQuarkGenerator(8).isUnlocked) return;
  for (let tier = 5; tier <= 8; ++tier) {
    if (DownQuarkGenerator(tier).isUnlocked) continue;
    DownQuarkGenerator(tier).tryUnlock();
  }
}*/