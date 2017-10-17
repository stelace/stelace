// ownerPrice set by owner, ownerPriceAfterRebate after deducing nbFreeDays
// 3% ownerFees deduced from ownerPriceAfterRebate
// owner receives only 97% of ownerPriceAfterRebate
// ownerNetIncome = 0.97 * ownerPriceAfterRebate

// 12% commission deduced from takerPriceAfterRebate gives ownerPriceAfterRebate
// insuranceFees in percents also apply (e.g. 5%). Extra fixed fees may be added to takerFees
// takerFees = (0.12+insuranceFees) * (ownerPriceAfterRebate + takerFees) gives :
// takerFees = (0.12+insuranceFees)/0.88 * ownerPriceAfterRebate
// takerPrice = ownerPriceAfterRebate + takerFees, nbFreeDays

// "freeValue" represents value of free days used BEFORE takerFees and ownerFees for simplicty
// freeValue = ownerPrice - ownerPriceAfterRebate

/**
 * @param args
 * - *ownerPrice
 * - freeValue
 * - ownerFeesPercent
 * - takerFeesPercent
 * - insuranceFeesPercent
 * - insuranceFeesFlat
 */
var getPriceAfterRebateAndFees = function (args) {
    var ownerPrice           = args.ownerPrice;
    var freeValue            = args.freeValue || 0;
    var ownerFeesPercent     = args.ownerFeesPercent || 0;
    var takerFeesPercent     = args.takerFeesPercent || 0;
    var insuranceFeesPercent = args.insuranceFeesPercent || 0;
    // var insuranceFeesFlat    = args.insuranceFeesFlat || 0;

    var ownerPriceAfterRebate = ownerPrice - freeValue;
    var ownerNetIncome        = Math.round((100 - ownerFeesPercent) / 100 * ownerPriceAfterRebate);
    var deltaOwnerTakerPrice  = Math.round((takerFeesPercent + insuranceFeesPercent) / (100 - takerFeesPercent) * ownerPriceAfterRebate);
    var takerPrice            = ownerPriceAfterRebate + deltaOwnerTakerPrice;

    return {
        ownerPriceAfterRebate: ownerPriceAfterRebate,
        ownerNetIncome: ownerNetIncome,
        takerPrice: takerPrice
    };
};

console.log(getPriceAfterRebateAndFees({
    ownerPrice: 100,
    freeValue: 20,
    ownerFeesPercent: 3,
    takerFeesPercent: 12,
    insuranceFeesPercent: 5
}));
