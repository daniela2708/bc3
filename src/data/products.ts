/**
 * Product master for the prototype: Department › Category › Subcategory › Price Group › SKU.
 * Brand and vendor names are real consumer brands used for illustration only; every figure (retail, cost, volume,
 * SKU numbers and UPCs) is invented. UPCs use made-up manufacturer prefixes with a valid check digit.
 */
import { hash01, nameKey } from './prng';
import { upcA } from '../lib/upc';

export type Uom = 'ea' | 'lb';
/** Supply source: shipped from a Weis distribution center (DC) or delivered to the store by the vendor (DSD). */
export type SupplySource = 'DC' | 'DSD';
/**
 * Vendors that deliver direct to store in this simulated catalog (illustrative). Every other vendor ships through
 * the DC. The supply source sets the cost basis (#15) and which vendor funding Net GM $ adds (#7).
 */
export const DSD_VENDORS: ReadonlySet<string> = new Set(['Frito-Lay', 'The Coca-Cola Company', 'PepsiCo Beverages', 'Turkey Hill Dairy']);
/** How often the generator promotes a price group, and with which promo types. */
export type PromoProfile = 'hot' | 'std' | 'low' | 'lock';

interface ItemSpec {
  n: string;
  /** Regular retail per unit (ea) or per lb. */
  r: number;
  /** Weekly chain volume at regular price (ea or lb). */
  wu: number;
  /** Seasonal item: sells only between these calendar months (inclusive, may wrap the year end). */
  season?: [number, number];
  /** PLU for random-weight and loose produce items (no UPC). */
  plu?: string;
}
interface PgSpec {
  name: string;
  brand: string;
  vendor: string;
  profile: PromoProfile;
  uom?: Uom;
  items: ItemSpec[];
}
interface SubSpec {
  name: string;
  pgs: PgSpec[];
}
interface CatSpec {
  name: string;
  subs: SubSpec[];
}
interface DeptSpec {
  name: string;
  /** Typical gross margin rate at regular retail. */
  gm: number;
  /** Average total basket ($) of transactions that include the department (shopper metrics). */
  basket: number;
  cats: CatSpec[];
}

const WQ = 'Weis Quality';
const WEIS = 'Weis Markets (own brand)';

const CATALOG: DeptSpec[] = [
  {
    name: 'Grocery',
    gm: 0.34,
    basket: 58,
    cats: [
      {
        name: 'Snacks',
        subs: [
          {
            name: 'Potato Chips',
            pgs: [
              { name: "Lay's Potato Chips 8 oz", brand: "Lay's", vendor: 'Frito-Lay', profile: 'hot', items: [{ n: "Lay's Classic 8 oz", r: 5.29, wu: 7200 }, { n: "Lay's Wavy Original 8 oz", r: 5.29, wu: 3100 }, { n: "Lay's Barbecue 8 oz", r: 5.29, wu: 2600 }] },
              { name: 'Ruffles Potato Chips 8 oz', brand: 'Ruffles', vendor: 'Frito-Lay', profile: 'std', items: [{ n: 'Ruffles Original 8 oz', r: 5.29, wu: 3900 }, { n: 'Ruffles Cheddar & Sour Cream 8 oz', r: 5.29, wu: 2400 }] },
              { name: 'Weis Quality Potato Chips 9 oz', brand: WQ, vendor: WEIS, profile: 'low', items: [{ n: 'Weis Quality Original Chips 9 oz', r: 3.49, wu: 4100 }, { n: 'Weis Quality Ripple Chips 9 oz', r: 3.49, wu: 2200 }] },
            ],
          },
          {
            name: 'Tortilla Chips',
            pgs: [
              { name: 'Tostitos Tortilla Chips 13 oz', brand: 'Tostitos', vendor: 'Frito-Lay', profile: 'hot', items: [{ n: 'Tostitos Scoops 10 oz', r: 5.79, wu: 4200 }, { n: 'Tostitos Restaurant Style 13 oz', r: 5.79, wu: 3800 }] },
              { name: 'Doritos 9.25 oz', brand: 'Doritos', vendor: 'Frito-Lay', profile: 'std', items: [{ n: 'Doritos Nacho Cheese 9.25 oz', r: 5.79, wu: 5100 }, { n: 'Doritos Cool Ranch 9.25 oz', r: 5.79, wu: 3600 }] },
            ],
          },
        ],
      },
      {
        name: 'Candy',
        subs: [
          {
            name: 'Chocolate Candy',
            pgs: [
              {
                name: "M&M's Sharing Size",
                brand: "M&M's",
                vendor: 'Mars Wrigley',
                profile: 'std',
                items: [
                  { n: "M&M's Peanut Sharing Size 10.05 oz", r: 5.99, wu: 2900 },
                  { n: "M&M's Milk Chocolate Sharing Size 10.7 oz", r: 5.99, wu: 2500 },
                  { n: "M&M's Halloween Fun Size 10.53 oz", r: 5.99, wu: 5200, season: [9, 10] },
                  { n: "M&M's Holiday Milk Chocolate 10 oz", r: 5.99, wu: 3400, season: [11, 12] },
                ],
              },
              { name: "Hershey's Milk Chocolate Bars 6 pk", brand: "Hershey's", vendor: 'The Hershey Company', profile: 'std', items: [{ n: "Hershey's Milk Chocolate 6 pk", r: 6.49, wu: 2100 }, { n: "Hershey's Milk Chocolate with Almonds 6 pk", r: 6.49, wu: 1200 }] },
              { name: "Reese's Peanut Butter Cups", brand: "Reese's", vendor: 'The Hershey Company', profile: 'std', items: [{ n: "Reese's Peanut Butter Cups 10.5 oz", r: 5.99, wu: 2600 }, { n: "Reese's Pumpkins Snack Size 9.6 oz", r: 5.99, wu: 3600, season: [9, 10] }] },
            ],
          },
        ],
      },
      {
        name: 'Breakfast',
        subs: [
          {
            name: 'Cold Cereal',
            pgs: [
              { name: 'Cheerios Family Size', brand: 'Cheerios', vendor: 'General Mills', profile: 'std', items: [{ n: 'Cheerios Family Size 18 oz', r: 6.29, wu: 4300 }, { n: 'Honey Nut Cheerios Family Size 18.8 oz', r: 6.29, wu: 5600 }] },
              { name: "Kellogg's Family Size Cereal", brand: "Kellogg's", vendor: 'Kellanova', profile: 'hot', items: [{ n: "Kellogg's Frosted Flakes 24 oz", r: 6.49, wu: 3900 }, { n: "Kellogg's Froot Loops 19.4 oz", r: 6.49, wu: 2600 }] },
              { name: 'Weis Quality Cereal', brand: WQ, vendor: WEIS, profile: 'low', items: [{ n: 'Weis Quality Toasted Oats 18 oz', r: 3.99, wu: 2700 }, { n: 'Weis Quality Frosted Flakes 24 oz', r: 3.99, wu: 2300 }] },
            ],
          },
        ],
      },
      {
        name: 'Beverages',
        subs: [
          {
            name: 'Soft Drinks',
            pgs: [
              { name: 'Coca-Cola 12 pk 12 oz Cans', brand: 'Coca-Cola', vendor: 'The Coca-Cola Company', profile: 'hot', items: [{ n: 'Coca-Cola 12 pk 12 oz', r: 8.99, wu: 21000 }, { n: 'Diet Coke 12 pk 12 oz', r: 8.99, wu: 12500 }, { n: 'Coca-Cola Zero Sugar 12 pk 12 oz', r: 8.99, wu: 9800 }, { n: 'Sprite 12 pk 12 oz', r: 8.99, wu: 6900 }] },
              { name: 'Coca-Cola 2 L', brand: 'Coca-Cola', vendor: 'The Coca-Cola Company', profile: 'std', items: [{ n: 'Coca-Cola 2 L', r: 3.29, wu: 14800 }, { n: 'Diet Coke 2 L', r: 3.29, wu: 7600 }] },
              { name: 'Pepsi 12 pk 12 oz Cans', brand: 'Pepsi', vendor: 'PepsiCo Beverages', profile: 'hot', items: [{ n: 'Pepsi 12 pk 12 oz', r: 8.99, wu: 15800 }, { n: 'Diet Pepsi 12 pk 12 oz', r: 8.99, wu: 6200 }, { n: 'Mountain Dew 12 pk 12 oz', r: 8.99, wu: 8900 }] },
            ],
          },
          {
            name: 'Water',
            pgs: [
              { name: 'Poland Spring 24 pk 16.9 oz', brand: 'Poland Spring', vendor: 'BlueTriton Brands', profile: 'std', items: [{ n: 'Poland Spring Water 24 pk 16.9 oz', r: 6.99, wu: 9800 }] },
              { name: 'Weis Quality Water 24 pk 16.9 oz', brand: WQ, vendor: WEIS, profile: 'lock', items: [{ n: 'Weis Quality Purified Water 24 pk 16.9 oz', r: 3.99, wu: 13800 }] },
            ],
          },
        ],
      },
      {
        name: 'Pasta & Sauce',
        subs: [
          {
            name: 'Pasta Sauce',
            pgs: [
              { name: 'Ragú Pasta Sauce 24 oz', brand: 'Ragú', vendor: 'Mizkan America', profile: 'std', items: [{ n: 'Ragú Old World Style Traditional 24 oz', r: 3.79, wu: 6300 }, { n: 'Ragú Chunky Garden Combination 24 oz', r: 3.79, wu: 2700 }] },
              { name: 'Prego Pasta Sauce 24 oz', brand: 'Prego', vendor: 'The Campbell’s Company', profile: 'std', items: [{ n: 'Prego Traditional 24 oz', r: 3.99, wu: 5600 }, { n: 'Prego Meat Sauce 24 oz', r: 3.99, wu: 2300 }] },
            ],
          },
          {
            name: 'Dry Pasta',
            pgs: [{ name: 'Barilla Pasta 16 oz', brand: 'Barilla', vendor: 'Barilla America', profile: 'std', items: [{ n: 'Barilla Spaghetti 16 oz', r: 2.29, wu: 9100 }, { n: 'Barilla Penne 16 oz', r: 2.29, wu: 6800 }, { n: 'Barilla Rotini 16 oz', r: 2.29, wu: 4200 }] }],
          },
        ],
      },
    ],
  },
  {
    name: 'Dairy',
    gm: 0.31,
    basket: 54,
    cats: [
      {
        name: 'Yogurt',
        subs: [
          {
            name: 'Greek Yogurt',
            pgs: [
              { name: 'Chobani Greek Yogurt 5.3 oz', brand: 'Chobani', vendor: 'Chobani', profile: 'std', items: [{ n: 'Chobani Greek Plain 5.3 oz', r: 1.59, wu: 11800 }, { n: 'Chobani Greek Strawberry 5.3 oz', r: 1.59, wu: 14200 }, { n: 'Chobani Greek Blueberry 5.3 oz', r: 1.59, wu: 10500 }] },
              { name: 'Oikos Pro Yogurt 5.3 oz', brand: 'Oikos', vendor: 'Danone North America', profile: 'std', items: [{ n: 'Oikos Pro Vanilla 5.3 oz', r: 1.79, wu: 8100 }, { n: 'Oikos Pro Mixed Berry 5.3 oz', r: 1.79, wu: 6400 }] },
            ],
          },
        ],
      },
      {
        name: 'Cheese',
        subs: [
          {
            name: 'Shredded Cheese',
            pgs: [
              { name: 'Kraft Shredded Cheese 8 oz', brand: 'Kraft', vendor: 'The Kraft Heinz Company', profile: 'hot', items: [{ n: 'Kraft Mexican Style Four Cheese 8 oz', r: 3.99, wu: 7900 }, { n: 'Kraft Low-Moisture Mozzarella 8 oz', r: 3.99, wu: 6900 }, { n: 'Kraft Sharp Cheddar 8 oz', r: 3.99, wu: 6100 }] },
              { name: 'Weis Quality Shredded Cheese 8 oz', brand: WQ, vendor: WEIS, profile: 'low', items: [{ n: 'Weis Quality Shredded Mozzarella 8 oz', r: 2.79, wu: 8700 }, { n: 'Weis Quality Shredded Cheddar 8 oz', r: 2.79, wu: 7400 }] },
            ],
          },
        ],
      },
      {
        name: 'Milk',
        subs: [{ name: 'Plant-Based Milk', pgs: [{ name: 'Silk Almondmilk 64 oz', brand: 'Silk', vendor: 'Danone North America', profile: 'std', items: [{ n: 'Silk Original Almondmilk 64 oz', r: 4.49, wu: 4600 }, { n: 'Silk Unsweetened Vanilla Almondmilk 64 oz', r: 4.49, wu: 3900 }] }] }],
      },
    ],
  },
  {
    name: 'Frozen',
    gm: 0.34,
    basket: 61,
    cats: [
      {
        name: 'Frozen Pizza',
        subs: [
          {
            name: 'Rising Crust Pizza',
            pgs: [
              { name: 'DiGiorno Rising Crust Pizza', brand: 'DiGiorno', vendor: 'Nestlé USA', profile: 'hot', items: [{ n: 'DiGiorno Rising Crust Pepperoni', r: 8.49, wu: 4900 }, { n: 'DiGiorno Rising Crust Supreme', r: 8.49, wu: 2900 }, { n: 'DiGiorno Rising Crust Four Cheese', r: 8.49, wu: 2600 }] },
              { name: 'Tombstone Original Pizza', brand: 'Tombstone', vendor: 'Nestlé USA', profile: 'std', items: [{ n: 'Tombstone Original Pepperoni', r: 4.99, wu: 3700 }, { n: 'Tombstone Original Extra Cheese', r: 4.99, wu: 2100 }] },
            ],
          },
        ],
      },
      {
        name: 'Ice Cream',
        subs: [
          {
            name: 'Ice Cream Tubs',
            pgs: [
              { name: 'Turkey Hill Ice Cream 46 oz', brand: 'Turkey Hill', vendor: 'Turkey Hill Dairy', profile: 'hot', items: [{ n: 'Turkey Hill Vanilla Bean 46 oz', r: 5.99, wu: 4700 }, { n: 'Turkey Hill Chocolate Peanut Butter Cup 46 oz', r: 5.99, wu: 3100 }, { n: 'Turkey Hill Peppermint Stick 46 oz', r: 5.99, wu: 2800, season: [11, 12] }] },
              { name: 'Breyers Ice Cream 48 oz', brand: 'Breyers', vendor: 'The Magnum Ice Cream Company', profile: 'std', items: [{ n: 'Breyers Natural Vanilla 48 oz', r: 6.49, wu: 3600 }, { n: 'Breyers Mint Chocolate Chip 48 oz', r: 6.49, wu: 1900 }] },
              { name: 'Weis Quality Ice Cream 48 oz', brand: WQ, vendor: WEIS, profile: 'low', items: [{ n: 'Weis Quality Vanilla Ice Cream 48 oz', r: 3.99, wu: 5200 }, { n: 'Weis Quality Moose Tracks Ice Cream 48 oz', r: 3.99, wu: 2900 }] },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'HBC',
    gm: 0.41,
    basket: 72,
    cats: [
      {
        name: 'Oral Care',
        subs: [
          {
            name: 'Toothpaste',
            pgs: [
              { name: 'Crest Toothpaste', brand: 'Crest', vendor: 'Procter & Gamble', profile: 'std', items: [{ n: 'Crest 3D White Radiant Mint 3.8 oz', r: 4.99, wu: 2100 }, { n: 'Crest Pro-Health Clean Mint 4.6 oz', r: 5.49, wu: 1600 }] },
              { name: 'Colgate Toothpaste', brand: 'Colgate', vendor: 'Colgate-Palmolive', profile: 'std', items: [{ n: 'Colgate Total Whitening 4.8 oz', r: 5.49, wu: 1900 }, { n: 'Colgate Optic White 3.2 oz', r: 4.99, wu: 1700 }] },
            ],
          },
        ],
      },
      {
        name: 'Hair Care',
        subs: [
          {
            name: 'Shampoo & Conditioner',
            pgs: [
              { name: 'Pantene Pro-V 12 oz', brand: 'Pantene', vendor: 'Procter & Gamble', profile: 'std', items: [{ n: 'Pantene Pro-V Daily Moisture Shampoo 12 oz', r: 6.99, wu: 1300 }, { n: 'Pantene Pro-V Daily Moisture Conditioner 12 oz', r: 6.99, wu: 1100 }] },
              { name: 'Head & Shoulders 12.5 oz', brand: 'Head & Shoulders', vendor: 'Procter & Gamble', profile: 'std', items: [{ n: 'Head & Shoulders Classic Clean 12.5 oz', r: 7.99, wu: 1500 }] },
            ],
          },
        ],
      },
      {
        name: 'Pain Relief',
        subs: [
          {
            name: 'Analgesics',
            pgs: [
              { name: 'Advil 100 ct', brand: 'Advil', vendor: 'Haleon', profile: 'std', items: [{ n: 'Advil Tablets 200 mg 100 ct', r: 12.99, wu: 900 }, { n: 'Advil Liqui-Gels 80 ct', r: 13.99, wu: 700 }] },
              { name: 'Tylenol Extra Strength 100 ct', brand: 'Tylenol', vendor: 'Kenvue', profile: 'std', items: [{ n: 'Tylenol Extra Strength Caplets 100 ct', r: 13.49, wu: 800 }] },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'GM',
    gm: 0.37,
    basket: 66,
    cats: [
      {
        name: 'Household Cleaning',
        subs: [
          {
            name: 'Disinfecting Wipes',
            pgs: [
              { name: 'Clorox Disinfecting Wipes', brand: 'Clorox', vendor: 'The Clorox Company', profile: 'std', items: [{ n: 'Clorox Disinfecting Wipes Fresh Scent 75 ct', r: 6.99, wu: 3600 }, { n: 'Clorox Disinfecting Wipes Lemon 75 ct', r: 6.99, wu: 2400 }, { n: 'Clorox Disinfecting Wipes Value 3 pk', r: 13.99, wu: 1300 }] },
              { name: 'Lysol Disinfecting Wipes', brand: 'Lysol', vendor: 'Reckitt', profile: 'std', items: [{ n: 'Lysol Disinfecting Wipes Lemon & Lime 80 ct', r: 6.79, wu: 2600 }] },
            ],
          },
          {
            name: 'Spray Cleaners',
            pgs: [
              { name: 'Clorox Clean-Up', brand: 'Clorox', vendor: 'The Clorox Company', profile: 'std', items: [{ n: 'Clorox Clean-Up Cleaner with Bleach 32 oz', r: 5.49, wu: 1700 }, { n: 'Clorox Clean-Up Refill 180 oz', r: 14.99, wu: 400 }] },
              { name: 'Lysol All-Purpose Cleaner', brand: 'Lysol', vendor: 'Reckitt', profile: 'std', items: [{ n: 'Lysol All-Purpose Cleaner Lemon 32 oz', r: 4.99, wu: 1500 }] },
            ],
          },
          {
            name: 'Laundry Detergent',
            pgs: [
              { name: 'Tide Liquid Detergent 92 oz', brand: 'Tide', vendor: 'Procter & Gamble', profile: 'std', items: [{ n: 'Tide Original Liquid 92 oz', r: 15.99, wu: 2900 }, { n: 'Tide Free & Gentle Liquid 92 oz', r: 15.99, wu: 1700 }] },
              { name: 'Gain Liquid Detergent 88 oz', brand: 'Gain', vendor: 'Procter & Gamble', profile: 'std', items: [{ n: 'Gain Original Liquid 88 oz', r: 13.99, wu: 2300 }] },
            ],
          },
        ],
      },
      {
        name: 'Paper Products',
        subs: [
          {
            name: 'Paper Towels',
            pgs: [
              { name: 'Bounty Select-A-Size 6 Double Rolls', brand: 'Bounty', vendor: 'Procter & Gamble', profile: 'std', items: [{ n: 'Bounty Select-A-Size White 6 Double Rolls', r: 11.99, wu: 5200 }, { n: 'Bounty Select-A-Size Print 6 Double Rolls', r: 11.99, wu: 1800 }] },
              { name: 'Weis Quality Paper Towels 6 Rolls', brand: WQ, vendor: WEIS, profile: 'low', items: [{ n: 'Weis Quality Paper Towels 6 Big Rolls', r: 6.99, wu: 3800 }] },
            ],
          },
          {
            name: 'Bath Tissue',
            pgs: [
              { name: 'Charmin 12 Mega Rolls', brand: 'Charmin', vendor: 'Procter & Gamble', profile: 'hot', items: [{ n: 'Charmin Ultra Soft 12 Mega Rolls', r: 16.99, wu: 3900 }, { n: 'Charmin Ultra Strong 12 Mega Rolls', r: 16.99, wu: 3100 }] },
              { name: 'Cottonelle 12 Mega Rolls', brand: 'Cottonelle', vendor: 'Kimberly-Clark', profile: 'std', items: [{ n: 'Cottonelle Ultra Clean 12 Mega Rolls', r: 15.99, wu: 2700 }] },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Meat',
    gm: 0.27,
    basket: 79,
    cats: [
      {
        name: 'Beef',
        subs: [
          {
            name: 'Ground Beef',
            pgs: [
              { name: 'Ground Beef 80/20 Family Pack', brand: WQ, vendor: 'Cargill Protein', profile: 'hot', uom: 'lb', items: [{ n: 'Ground Beef 80/20 Family Pack (per lb)', r: 5.49, wu: 52000, plu: '21101' }, { n: 'Ground Chuck 80/20 (per lb)', r: 5.79, wu: 21000, plu: '21102' }] },
              { name: 'Ground Beef 90/10', brand: WQ, vendor: 'Cargill Protein', profile: 'std', uom: 'lb', items: [{ n: 'Ground Sirloin 90/10 (per lb)', r: 7.49, wu: 14000, plu: '21105' }, { n: 'Ground Round 85/15 (per lb)', r: 6.49, wu: 17000, plu: '21104' }] },
            ],
          },
          {
            name: 'Steaks',
            pgs: [{ name: 'Beef Steaks Value Pack', brand: WQ, vendor: 'Cargill Protein', profile: 'std', uom: 'lb', items: [{ n: 'Boneless Beef Chuck Steak (per lb)', r: 7.99, wu: 9000, plu: '21201' }, { n: 'Beef Strip Steak (per lb)', r: 14.99, wu: 6500, plu: '21202' }] }],
          },
        ],
      },
      {
        name: 'Chicken',
        subs: [
          {
            name: 'Fresh Chicken',
            pgs: [
              { name: 'Perdue Boneless Chicken Breast Value Pack', brand: 'Perdue', vendor: 'Perdue Farms', profile: 'hot', uom: 'lb', items: [{ n: 'Perdue Boneless Skinless Chicken Breast Value Pack (per lb)', r: 4.99, wu: 41000, plu: '22101' }] },
              { name: 'Chicken Thighs Value Pack', brand: WQ, vendor: 'Perdue Farms', profile: 'low', uom: 'lb', items: [{ n: 'Boneless Skinless Chicken Thighs Value Pack (per lb)', r: 3.99, wu: 23000, plu: '22102' }] },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Produce',
    gm: 0.38,
    basket: 63,
    cats: [
      {
        name: 'Fruit',
        subs: [
          { name: 'Berries', pgs: [{ name: "Driscoll's Strawberries 1 lb", brand: "Driscoll's", vendor: "Driscoll's", profile: 'hot', items: [{ n: "Driscoll's Strawberries 1 lb clamshell", r: 4.99, wu: 24000 }] }, { name: "Driscoll's Blueberries 1 pt", brand: "Driscoll's", vendor: "Driscoll's", profile: 'std', items: [{ n: "Driscoll's Blueberries 1 pt", r: 4.49, wu: 15000 }] }] },
          {
            name: 'Apples',
            pgs: [
              { name: 'Honeycrisp Apples', brand: 'Loose produce', vendor: 'Rice Fruit Company', profile: 'std', uom: 'lb', items: [{ n: 'Honeycrisp Apples (per lb)', r: 2.99, wu: 26000, plu: '3283' }] },
              { name: 'Gala Apples', brand: 'Loose produce', vendor: 'Rice Fruit Company', profile: 'low', uom: 'lb', items: [{ n: 'Gala Apples (per lb)', r: 1.99, wu: 21000, plu: '4133' }] },
            ],
          },
          { name: 'Bananas', pgs: [{ name: 'Bananas', brand: 'Loose produce', vendor: 'Chiquita Brands', profile: 'lock', uom: 'lb', items: [{ n: 'Bananas (per lb)', r: 0.65, wu: 155000, plu: '4011' }] }] },
        ],
      },
      {
        name: 'Vegetables',
        subs: [
          { name: 'Avocados', pgs: [{ name: 'Hass Avocados', brand: 'Loose produce', vendor: 'Mission Produce', profile: 'hot', items: [{ n: 'Hass Avocado (each)', r: 1.49, wu: 31000, plu: '4046' }] }] },
          { name: 'Salad Kits', pgs: [{ name: 'Dole Chopped Salad Kits', brand: 'Dole', vendor: 'Dole Fresh Vegetables', profile: 'std', items: [{ n: 'Dole Chopped Caesar Kit 11.4 oz', r: 4.49, wu: 6800 }, { n: 'Dole Chopped Sweet Kale Kit 12 oz', r: 4.49, wu: 4900 }] }] },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------- Flattened master

export interface Dept {
  idx: number;
  name: string;
  gm: number;
  basket: number;
  cats: number[];
}
export interface Cat {
  idx: number;
  dept: number;
  name: string;
  subs: number[];
}
export interface Sub {
  idx: number;
  cat: number;
  dept: number;
  name: string;
  pgs: number[];
}
export interface PriceGroup {
  idx: number;
  name: string;
  brand: number;
  vendor: number;
  profile: PromoProfile;
  uom: Uom;
  source: SupplySource;
  dept: number;
  cat: number;
  sub: number;
  items: number[];
}
export interface Item {
  idx: number;
  /** Internal SKU Number (6 digits). */
  sku: string;
  /** UPC-A for packaged items, null for PLU items. */
  upc: string | null;
  plu: string | null;
  name: string;
  uom: Uom;
  /** Current regular retail per unit or lb. */
  retail: number;
  /** Current unit cost. */
  cost: number;
  weeklyUnits: number;
  season: [number, number] | null;
  source: SupplySource;
  pg: number;
  brand: number;
  vendor: number;
  dept: number;
  cat: number;
  sub: number;
}

export const DEPTS: Dept[] = [];
export const CATS: Cat[] = [];
export const SUBS: Sub[] = [];
export const PRICE_GROUPS: PriceGroup[] = [];
export const ITEMS: Item[] = [];
export const BRANDS: string[] = [];
export const VENDORS: string[] = [];

function indexOf(list: string[], name: string): number {
  let i = list.indexOf(name);
  if (i < 0) {
    i = list.length;
    list.push(name);
  }
  return i;
}

/** Made-up 6-digit manufacturer prefix per vendor (leading 0, as in UPC-A number system 0). */
function vendorPrefix(vendor: string): string {
  return `0${String(10000 + Math.floor(hash01(nameKey(vendor), 3) * 89999)).padStart(5, '0')}`;
}

for (const d of CATALOG) {
  const dept: Dept = { idx: DEPTS.length, name: d.name, gm: d.gm, basket: d.basket, cats: [] };
  DEPTS.push(dept);
  for (const c of d.cats) {
    const cat: Cat = { idx: CATS.length, dept: dept.idx, name: c.name, subs: [] };
    CATS.push(cat);
    dept.cats.push(cat.idx);
    for (const s of c.subs) {
      const sub: Sub = { idx: SUBS.length, cat: cat.idx, dept: dept.idx, name: s.name, pgs: [] };
      SUBS.push(sub);
      cat.subs.push(sub.idx);
      for (const p of s.pgs) {
        const pg: PriceGroup = {
          idx: PRICE_GROUPS.length,
          name: p.name,
          brand: indexOf(BRANDS, p.brand),
          vendor: indexOf(VENDORS, p.vendor),
          profile: p.profile,
          uom: p.uom ?? 'ea',
          source: DSD_VENDORS.has(p.vendor) ? 'DSD' : 'DC',
          dept: dept.idx,
          cat: cat.idx,
          sub: sub.idx,
          items: [],
        };
        PRICE_GROUPS.push(pg);
        sub.pgs.push(pg.idx);
        for (const it of p.items) {
          const idx = ITEMS.length;
          const k = nameKey(it.n);
          const gm = d.gm + 0.08 * (hash01(k, 1) - 0.5);
          const ref = String(10000 + ((idx * 7919 + Math.floor(hash01(k, 2) * 50000)) % 89999)).padStart(5, '0');
          ITEMS.push({
            idx,
            sku: String(210000 + idx * 37 + Math.floor(hash01(k, 4) * 30)),
            upc: it.plu ? null : upcA(vendorPrefix(p.vendor) + ref),
            plu: it.plu ?? null,
            name: it.n,
            uom: pg.uom,
            retail: it.r,
            cost: Math.round(it.r * (1 - gm) * 100) / 100,
            weeklyUnits: it.wu,
            season: it.season ?? null,
            source: pg.source,
            pg: pg.idx,
            brand: pg.brand,
            vendor: pg.vendor,
            dept: dept.idx,
            cat: cat.idx,
            sub: sub.idx,
          });
          pg.items.push(idx);
        }
      }
    }
  }
}

export const ITEM_BY_CODE = new Map<string, number>();
for (const it of ITEMS) {
  if (it.upc) ITEM_BY_CODE.set(it.upc, it.idx);
  if (it.plu) ITEM_BY_CODE.set(it.plu, it.idx);
}
export const ITEM_BY_SKU = new Map(ITEMS.map((i) => [i.sku, i.idx]));

export function pgByName(name: string): PriceGroup {
  const pg = PRICE_GROUPS.find((p) => p.name === name);
  if (!pg) throw new Error(`Unknown price group ${name}`);
  return pg;
}

/** Seasonal items sell only inside their month window; this tells whether a month is in it. */
export function inSeason(item: Pick<Item, 'season'>, month: number): boolean {
  if (!item.season) return true;
  const [a, b] = item.season;
  return a <= b ? month >= a && month <= b : month >= a || month <= b;
}

/** Item code as shown to users: UPC for packaged goods, PLU for random-weight and loose items. */
export function itemCode(it: Pick<Item, 'upc' | 'plu'>): string {
  return it.upc ?? `PLU ${it.plu}`;
}
