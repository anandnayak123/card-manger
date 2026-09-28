// benefit-suggestions.js — a small, hand-curated starter dataset for a
// few common Indian credit cards. This is NOT live data pulled from any
// bank automatically (that would be unreliable and against most banks'
// terms of use) — it's a manually researched starting point you can edit,
// add to, or delete entirely. Always verify current terms with your bank,
// since card benefits change often.

const BENEFIT_SUGGESTIONS = [
  {
    match: ["tata neu", "tata"],
    bankHint: "HDFC",
    categories: {
      discountsDeals: [
        { title: "Welcome NeuCoins", description: "~1,499 NeuCoins credited on your first transaction within 30 days of card issuance." },
      ],
      cashback: [
        { title: "Up to 5-10% NeuCoins on Tata brands", description: "Earn NeuCoins on BigBasket, Croma, Westside, Tata 1mg, Tata CLiQ and other Tata Neu app purchases (rates vary by variant)." },
        { title: "1-1.5% NeuCoins on other spends", description: "Lower rate on non-Tata purchases." },
      ],
      entertainment: [],
      foodDining: [],
      shopping: [
        { title: "Tata ecosystem shopping", description: "Best value at BigBasket, Croma, Westside, Tata CLiQ, 1mg — redeem NeuCoins directly in the Tata Neu app." },
      ],
      hotels: [],
    },
  },
  {
    match: ["coral"],
    bankHint: "ICICI",
    categories: {
      discountsDeals: [
        { title: "BookMyShow / INOX movie discount", description: "~25% off movie tickets, up to 2 complimentary tickets/month (subject to quarterly spend threshold — check current terms)." },
      ],
      cashback: [
        { title: "ICICI Reward Points", description: "2 points per ₹100 spent (excl. fuel), 1 point per ₹100 on utilities/insurance." },
      ],
      entertainment: [
        { title: "Movie ticket offers", description: "Discounted tickets via BookMyShow/INOX." },
      ],
      foodDining: [
        { title: "ICICI Culinary Treats", description: "At least 15% off dining at 2,500+ partner restaurants across 12 cities." },
      ],
      shopping: [],
      hotels: [
        { title: "Airport & railway lounge access", description: "One complimentary domestic airport or railway lounge visit per quarter." },
      ],
    },
  },
  {
    match: ["eazydiner"],
    bankHint: "IndusInd",
    categories: {
      discountsDeals: [
        { title: "EazyDiner Prime membership", description: "Complimentary EazyDiner Prime (3-12 months depending on variant), normally worth ₹1,000-3,000/year." },
      ],
      cashback: [
        { title: "EazyPoints on other spends", description: "Base reward rate on non-dining purchases (check current rate — it has changed over time)." },
      ],
      entertainment: [],
      foodDining: [
        { title: "25-50% off at partner restaurants", description: "Discount at 2,000+ EazyDiner partner restaurants when booked/paid via the EazyDiner app." },
        { title: "Extra PayEazy discount", description: "Additional discount (capped per transaction) when paying the bill via PayEazy in the app." },
      ],
      shopping: [],
      hotels: [],
    },
  },
];

// Loosely matches a card's bank+type text against the dataset above.
// Returns the matching entry's `categories` object, or null if nothing fits.
function findBenefitSuggestion(bank, type) {
  const haystack = `${bank || ""} ${type || ""}`.toLowerCase();
  const found = BENEFIT_SUGGESTIONS.find((entry) =>
    entry.match.some((keyword) => haystack.includes(keyword))
  );
  return found ? found.categories : null;
}
