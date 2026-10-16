import { randomBytes, scryptSync } from "node:crypto";
import { DishDietaryType, PrismaClient, StaffRole } from "@prisma/client";

const prisma = new PrismaClient();

/** §9 — the fixed review vocabulary. Free text lives in the comment; tags stay countable. */
const REVIEW_TAGS = [
  "Delicious",
  "Spicy",
  "Mild",
  "Crispy",
  "Juicy",
  "Fresh",
  "Large portion",
  "Small portion",
  "Good value",
  "Expensive",
  "Great presentation",
  "Kid friendly",
];

const DEMO_PIN = process.env.SEED_DEMO_PIN ?? "4821";

function hashPin(pin: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pin, salt, 64).toString("hex")}`;
}

function qrToken(): string {
  return randomBytes(24).toString("base64url");
}

async function seedReviewTags(): Promise<void> {
  await Promise.all(
    REVIEW_TAGS.map((label, sortOrder) =>
      prisma.dishTag.upsert({ where: { label }, update: { sortOrder }, create: { label, sortOrder } })
    )
  );
  console.info(`Seeded ${REVIEW_TAGS.length} review tags`);
}

const DEMO_SLUG = "newa-kitchen";

interface MenuSection {
  category: string;
  emoji: string;
  dishes: { name: string; description: string; price: number; dietaryType: DishDietaryType; spiceLevel: number }[];
}

const MENU: MenuSection[] = [
  {
    category: "From the grill",
    emoji: "🔥",
    dishes: [
      { name: "Chicken Sekuwa", description: "Charcoal-grilled, marinated overnight in timur and mustard oil.", price: 45000, dietaryType: "NON_VEG", spiceLevel: 2 },
      { name: "Paneer Sekuwa", description: "Smoked cottage cheese skewers with roasted tomato achar.", price: 39000, dietaryType: "VEG", spiceLevel: 1 },
      { name: "Buff Choila", description: "Grilled buffalo, ginger, garlic and mustard oil. A Newari classic.", price: 42000, dietaryType: "NON_VEG", spiceLevel: 3 },
    ],
  },
  {
    category: "Momo",
    emoji: "🥟",
    dishes: [
      { name: "Buff Steam Momo", description: "Ten hand-pleated momo with sesame tomato achar.", price: 28000, dietaryType: "NON_VEG", spiceLevel: 1 },
      { name: "Veg Jhol Momo", description: "Steamed veg momo swimming in a sour, hot soybean broth.", price: 26000, dietaryType: "VEG", spiceLevel: 2 },
      { name: "Chicken C Momo", description: "Pan-tossed with onion, capsicum and chilli sauce.", price: 32000, dietaryType: "NON_VEG", spiceLevel: 3 },
    ],
  },
  {
    category: "Rice & noodles",
    emoji: "🍚",
    dishes: [
      { name: "Dal Bhat Set", description: "Lentils, seasonal tarkari, saag, pickle and papad. Free refills.", price: 35000, dietaryType: "VEG", spiceLevel: 1 },
      { name: "Chicken Thukpa", description: "Himalayan noodle soup with sliced chicken and greens.", price: 30000, dietaryType: "NON_VEG", spiceLevel: 2 },
      { name: "Veg Chowmein", description: "Wok-fired noodles with crunchy vegetables.", price: 22000, dietaryType: "VEG", spiceLevel: 1 },
    ],
  },
  {
    category: "Drinks & sweets",
    emoji: "🍵",
    dishes: [
      { name: "Masala Chiya", description: "Milk tea simmered with cardamom, ginger and clove.", price: 6000, dietaryType: "VEG", spiceLevel: 0 },
      { name: "Mango Lassi", description: "Thick yoghurt, ripe mango, a pinch of cardamom.", price: 15000, dietaryType: "VEG", spiceLevel: 0 },
      { name: "Juju Dhau", description: "Bhaktapur king curd, set in a clay pot.", price: 12000, dietaryType: "VEG", spiceLevel: 0 },
    ],
  },
];

const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** A restaurant you can actually sign into, so the API is explorable straight after a migrate. */
async function seedDemoRestaurant(): Promise<void> {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: DEMO_SLUG },
    update: {},
    create: {
      name: "Newa Kitchen",
      slug: DEMO_SLUG,
      tagline: "Kathmandu classics, cooked to order",
      description: "Charcoal grill, momo steamers and a chiya counter that never closes.",
      currency: "NPR",
      timezone: "Asia/Kathmandu",
      serviceChargeRate: 0.1,
      taxRate: 0.13,
      vatPanNumber: "609123456",
    },
  });

  // Every restaurant has exactly one default branch; tables, menus and orders hang off it.
  const branch = await prisma.branch.upsert({
    where: { restaurantId_slug: { restaurantId: restaurant.id, slug: "thamel" } },
    update: {},
    create: {
      restaurantId: restaurant.id,
      name: "Thamel",
      slug: "thamel",
      address: "Jyatha Marg, Thamel, Kathmandu",
      phone: "+977-1-4410000",
      isDefault: true,
    },
  });

  if ((await prisma.branchHours.count({ where: { branchId: branch.id } })) === 0) {
    await prisma.branchHours.createMany({
      data: [0, 1, 2, 3, 4, 5, 6].map(dayOfWeek => ({ branchId: branch.id, dayOfWeek, opensAt: "09:00", closesAt: "22:00" })),
    });
  }

  // Growth plan, active — every feature unlocked, no trial banner in the way.
  const plan = await prisma.plan.findUnique({ where: { key: "growth" } });
  if (plan) {
    const now = new Date();
    await prisma.subscription.upsert({
      where: { restaurantId: restaurant.id },
      update: {},
      create: {
        restaurantId: restaurant.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * DAY_MS),
      },
    });
  }

  const staff: { name: string; email: string; role: StaffRole }[] = [
    { name: "Aarati Shrestha", email: "owner@newa-kitchen.test", role: StaffRole.OWNER },
    { name: "Bikash Rai", email: "manager@newa-kitchen.test", role: StaffRole.MANAGER },
    { name: "Sunita Tamang", email: "staff@newa-kitchen.test", role: StaffRole.STAFF },
  ];

  for (const member of staff) {
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: {},
      create: { email: member.email, name: member.name, pinHash: hashPin(DEMO_PIN) },
    });

    const membership = await prisma.restaurantMember.upsert({
      where: { restaurantId_userId: { restaurantId: restaurant.id, userId: user.id } },
      update: { role: member.role },
      create: { restaurantId: restaurant.id, userId: user.id, role: member.role },
    });

    // Owners reach every branch; managers and staff are pinned to one.
    if (member.role !== StaffRole.OWNER) {
      await prisma.branchMember.upsert({
        where: { memberId_branchId: { memberId: membership.id, branchId: branch.id } },
        update: {},
        create: { memberId: membership.id, branchId: branch.id },
      });
    }
  }

  for (const [index, name] of ["T1", "T2", "T3", "T4", "T5", "T6", "Window 1", "Window 2"].entries()) {
    await prisma.diningTable.upsert({
      where: { branchId_name: { branchId: branch.id, name } },
      update: {},
      create: { restaurantId: restaurant.id, branchId: branch.id, name, qrToken: qrToken(), capacity: index < 6 ? 4 : 2, sortOrder: index },
    });
  }

  await prisma.floor.upsert({
    where: { branchId_name: { branchId: branch.id, name: "Rooftop" } },
    update: {},
    create: { restaurantId: restaurant.id, branchId: branch.id, name: "Rooftop", qrToken: qrToken() },
  });

  for (const [categoryIndex, section] of MENU.entries()) {
    const category = await prisma.menuCategory.upsert({
      where: { branchId_name: { branchId: branch.id, name: section.category } },
      update: { emoji: section.emoji, sortOrder: categoryIndex },
      create: { restaurantId: restaurant.id, branchId: branch.id, name: section.category, emoji: section.emoji, sortOrder: categoryIndex },
    });

    for (const [dishIndex, dish] of section.dishes.entries()) {
      const slug = slugify(dish.name);
      await prisma.dish.upsert({
        where: { branchId_slug: { branchId: branch.id, slug } },
        update: { price: dish.price },
        create: {
          restaurantId: restaurant.id,
          branchId: branch.id,
          categoryId: category.id,
          name: dish.name,
          slug,
          description: dish.description,
          price: dish.price,
          dietaryType: dish.dietaryType,
          spiceLevel: dish.spiceLevel,
          isFeatured: dish.name === "Chicken Sekuwa",
          sortOrder: dishIndex,
        },
      });
    }
  }

  console.info(`Seeded demo restaurant "${restaurant.name}" — sign in with any of ${staff.map(member => member.email).join(", ")} and PIN ${DEMO_PIN}`);
}

/* ── Trading history ───────────────────────────────────────────
   §9/§12/§48: every number the diner app shows — the recommend rate, the
   sub-scores, the badges, the rails — is gated on having enough evidence
   behind it. A restaurant with four dishes and no orders renders as "Not
   rated yet" everywhere, which makes the discovery half of the product look
   broken rather than empty. So the demo restaurant gets a plausible two
   months of trading: completed orders spread across both 30-day windows,
   and reviews with the spread of opinion those thresholds exist to weigh.  */

const DAY_MS = 24 * 60 * 60 * 1000;
const SEED_MARKER = "seed:";

/** Deterministic PRNG, so reseeding twice produces the same restaurant. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface DishHistory {
  slug: string;
  /** Units sold in the trailing 30 days, and in the 30 before that (§12). */
  unitsLast30: number;
  unitsPrev30: number;
  reviewCount: number;
  /** Sampled for each review — its mean is what the dish ends up rated. */
  ratingBag: number[];
  /** Nudges the "value for money" sub-score away from the overall star. */
  valueBias: number;
  wouldOrderAgainRate: number;
  comments: string[];
  tags: string[];
}

/** One profile per badge the merchandising rules can award, so each is reachable. */
const DISH_HISTORY: DishHistory[] = [
  {
    // The hit: sells enough to be "popular" and is rated well enough to be "loved".
    slug: "chicken-sekuwa",
    unitsLast30: 168,
    unitsPrev30: 126,
    reviewCount: 34,
    ratingBag: [5, 5, 5, 5, 4, 4, 5, 4],
    valueBias: 0,
    wouldOrderAgainRate: 0.88,
    comments: [
      "Charred exactly right, still juicy inside.",
      "Ordered this twice in one sitting. No regrets.",
      "The marinade is the whole thing. Ask for extra achar.",
      "Better than the sekuwa place near my office, honestly.",
    ],
    tags: ["Juicy", "Spicy", "Delicious"],
  },
  {
    // Steady seller, priced kindly — the "good value" case.
    slug: "buff-steam-momo",
    unitsLast30: 66,
    unitsPrev30: 60,
    reviewCount: 18,
    ratingBag: [5, 4, 4, 4, 5, 4, 3, 5],
    valueBias: 0.6,
    wouldOrderAgainRate: 0.78,
    comments: [
      "Ten pieces for this price is a steal.",
      "Solid momo. The jhol on the side is the move.",
      "Wrappers were a bit thick but the filling is good.",
    ],
    tags: ["Good value", "Large portion", "Fresh"],
  },
  {
    // Climbing fast: this window well ahead of the last — "trending".
    slug: "veg-jhol-momo",
    unitsLast30: 58,
    unitsPrev30: 26,
    reviewCount: 12,
    ratingBag: [5, 5, 4, 4, 5, 4, 4, 5],
    valueBias: 0.2,
    wouldOrderAgainRate: 0.83,
    comments: [
      "The jhol is properly sour and hot. Drink the leftovers.",
      "Did not miss the meat at all.",
      "Came out steaming. Perfect for the weather.",
    ],
    tags: ["Spicy", "Fresh", "Delicious"],
  },
  {
    // Quietly excellent and under-ordered — the "hidden gem".
    slug: "paneer-sekuwa",
    unitsLast30: 38,
    unitsPrev30: 31,
    reviewCount: 14,
    ratingBag: [5, 5, 5, 5, 4, 5, 5, 4],
    valueBias: -0.2,
    wouldOrderAgainRate: 0.9,
    comments: [
      "Nobody orders this and I do not understand why.",
      "Smokier than I expected. Excellent.",
      "The paneer stays soft, which is the hard part.",
    ],
    tags: ["Delicious", "Great presentation", "Mild"],
  },
];

const clampStar = (value: number) => Math.min(5, Math.max(1, Math.round(value)));

/** Dishes without a hand-tuned profile: a modest seller, a few unreviewed orders. */
function quietProfile(slug: string, random: () => number): DishHistory {
  return {
    slug,
    unitsLast30: 12 + Math.floor(random() * 20),
    unitsPrev30: 10 + Math.floor(random() * 20),
    reviewCount: 0,
    ratingBag: [4],
    valueBias: 0,
    wouldOrderAgainRate: 0.8,
    comments: [],
    tags: [],
  };
}

async function seedTradingHistory(): Promise<void> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: DEMO_SLUG },
    include: { branches: { where: { isDefault: true } } },
  });
  const branch = restaurant?.branches[0];
  if (!restaurant || !branch) return;

  const alreadySeeded = await prisma.order.count({
    where: { restaurantId: restaurant.id, idempotencyKey: { startsWith: SEED_MARKER } },
  });
  if (alreadySeeded > 0) {
    console.info(`Trading history already seeded (${alreadySeeded} orders) — skipping`);
    return;
  }

  const [tables, dishes, tags] = await Promise.all([
    prisma.diningTable.findMany({ where: { branchId: branch.id }, orderBy: { sortOrder: "asc" } }),
    prisma.dish.findMany({ where: { branchId: branch.id } }),
    prisma.dishTag.findMany(),
  ]);
  const tagIdByLabel = new Map(tags.map(tag => [tag.label, tag.id]));

  const random = mulberry32(20260913);
  const now = Date.now();
  let reference = 1000 + (await prisma.order.count({ where: { branchId: branch.id } }));
  let orders = 0;
  let reviews = 0;

  const profiles = dishes.map(
    dish => DISH_HISTORY.find(profile => profile.slug === dish.slug) ?? quietProfile(dish.slug, random)
  );

  for (const profile of profiles) {
    const dish = dishes.find(candidate => candidate.slug === profile.slug);
    if (!dish) continue;

    // Each window is filled to its unit target, so orders30d / ordersPrev30d —
    // and therefore the velocity ratio behind "trending" — land where intended.
    const placements: { placedAt: Date; quantity: number }[] = [];
    for (const [windowIndex, target] of [profile.unitsLast30, profile.unitsPrev30].entries()) {
      const windowEnd = now - windowIndex * 30 * DAY_MS;
      let units = 0;
      while (units < target) {
        const quantity = Math.min(1 + Math.floor(random() * 3), target - units);
        placements.push({
          placedAt: new Date(windowEnd - random() * 30 * DAY_MS - 60_000),
          quantity,
        });
        units += quantity;
      }
    }
    placements.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());

    // Reviews land on the most recent visits, the way real feedback does.
    const reviewedFrom = Math.max(0, placements.length - profile.reviewCount);

    for (const [index, placement] of placements.entries()) {
      const table = tables[Math.floor(random() * tables.length)];
      const subtotal = dish.price * placement.quantity;
      const serviceCharge = Math.round(subtotal * restaurant.serviceChargeRate);
      const tax = Math.round((subtotal + serviceCharge) * restaurant.taxRate);
      const completedAt = new Date(placement.placedAt.getTime() + 40 * 60_000);

      reference += 1;

      const session = await prisma.diningSession.create({
        data: {
          restaurantId: restaurant.id,
          branchId: branch.id,
          tableId: table.id,
          anonymousSessionToken: `${SEED_MARKER}${randomBytes(18).toString("base64url")}`,
          startedAt: placement.placedAt,
          expiresAt: new Date(placement.placedAt.getTime() + 3 * 60 * 60_000),
          endedAt: completedAt,
        },
      });

      const order = await prisma.order.create({
        data: {
          reference: `#${reference}`,
          restaurantId: restaurant.id,
          branchId: branch.id,
          tableId: table.id,
          sessionId: session.id,
          status: "COMPLETED",
          subtotal,
          serviceCharge,
          tax,
          discount: 0,
          total: subtotal + serviceCharge + tax,
          currency: restaurant.currency,
          idempotencyKey: `${SEED_MARKER}${dish.slug}:${index}`,
          createdAt: placement.placedAt,
          completedAt,
          items: {
            create: {
              dishId: dish.id,
              dishNameSnapshot: dish.name,
              imageUrlSnapshot: dish.imageUrl,
              unitPrice: dish.price,
              quantity: placement.quantity,
              status: "SERVED",
              createdAt: placement.placedAt,
            },
          },
        },
      });
      orders += 1;

      const method = random() < 0.6 ? "CASH" : "CARD";
      await prisma.payment.create({
        data: {
          restaurantId: restaurant.id,
          branchId: branch.id,
          sessionId: session.id,
          tableId: table.id,
          subtotal,
          serviceCharge,
          tax,
          total: order.total,
          method,
          // Paid in full, the way a till takes it: one collection for the whole bill.
          paidAmount: order.total,
          paymentStatus: "PAID",
          tenders: { create: { restaurantId: restaurant.id, branchId: branch.id, amount: order.total, method, paidAt: completedAt, createdAt: completedAt } },
          currency: restaurant.currency,
          createdAt: completedAt,
          createdByName: "Sunita Tamang",
          items: {
            create: { dishId: dish.id, dishNameSnapshot: dish.name, unitPrice: dish.price, quantity: placement.quantity, createdAt: completedAt },
          },
        },
      });

      if (index < reviewedFrom) continue;

      const overall = profile.ratingBag[Math.floor(random() * profile.ratingBag.length)];
      const reviewTags = profile.tags.filter(() => random() < 0.5).slice(0, 2);
      const comment = random() < 0.45 ? profile.comments[Math.floor(random() * profile.comments.length)] : "";

      await prisma.dishReview.create({
        data: {
          restaurantId: restaurant.id,
          dishId: dish.id,
          orderId: order.id,
          sessionId: session.id,
          overall,
          taste: clampStar(overall + (random() < 0.3 ? 1 : 0) - (random() < 0.2 ? 1 : 0)),
          portion: clampStar(overall - (random() < 0.35 ? 1 : 0)),
          value: clampStar(overall + profile.valueBias + (random() < 0.25 ? 1 : -0.4)),
          wouldOrderAgain: random() < profile.wouldOrderAgainRate,
          comment,
          createdAt: new Date(completedAt.getTime() + 25 * 60_000),
          ...(reviewTags.length && {
            tags: {
              create: reviewTags
                .map(label => tagIdByLabel.get(label))
                .filter((id): id is string => Boolean(id))
                .map(tagId => ({ tagId })),
            },
          }),
        },
      });
      reviews += 1;
    }
  }

  console.info(`Seeded ${orders} completed orders and ${reviews} reviews across the last 60 days`);
}

/* ── Inventory ─────────────────────────────────────────────────
   Quantities are integer base units (g / ml / pcs). Each ingredient starts
   with one received lot and no consumption — the seeded history above is not
   back-deducted, so stock reads as "just restocked", with a couple of items
   left under their par line to show the low-stock warning.            */

/** name, unit, quantity, parLevel, cost (minor units) of the lot */
const INGREDIENTS: [string, string, number, number, number][] = [
  ["Chicken", "g", 18000, 5000, 900000],
  ["Buffalo meat", "g", 14000, 4000, 840000],
  ["Paneer", "g", 1500, 2000, 195000], // low
  ["Maida flour", "g", 25000, 6000, 125000],
  ["Onion", "g", 12000, 3000, 60000],
  ["Tomato", "g", 2400, 3000, 36000], // low
  ["Mustard oil", "ml", 5000, 1500, 100000],
  ["Spice mix", "g", 3000, 800, 150000],
  ["Mixed vegetables", "g", 9000, 3000, 63000],
  ["Rice", "g", 40000, 10000, 200000],
  ["Lentils", "g", 10000, 3000, 140000],
  ["Noodles", "g", 8000, 2000, 80000],
  ["Milk", "ml", 30000, 8000, 270000],
  ["Tea leaves", "g", 1500, 400, 90000],
  ["Yoghurt", "g", 10000, 3000, 120000],
  ["Mango pulp", "ml", 6000, 1500, 90000],
];

/** dish slug → [ingredient, grams/ml per serving] */
const RECIPES: Record<string, [string, number][]> = {
  "chicken-sekuwa": [["Chicken", 250], ["Mustard oil", 20], ["Spice mix", 15]],
  "paneer-sekuwa": [["Paneer", 200], ["Mustard oil", 20], ["Tomato", 60]],
  "buff-choila": [["Buffalo meat", 250], ["Onion", 40], ["Mustard oil", 25], ["Spice mix", 15]],
  "buff-steam-momo": [["Buffalo meat", 120], ["Maida flour", 100], ["Onion", 40], ["Tomato", 50]],
  "veg-jhol-momo": [["Mixed vegetables", 150], ["Maida flour", 100], ["Tomato", 80]],
  "chicken-c-momo": [["Chicken", 120], ["Maida flour", 100], ["Onion", 50], ["Mustard oil", 15]],
  "dal-bhat-set": [["Rice", 250], ["Lentils", 100], ["Mixed vegetables", 120]],
  "chicken-thukpa": [["Chicken", 100], ["Noodles", 120], ["Mixed vegetables", 60]],
  "veg-chowmein": [["Noodles", 150], ["Mixed vegetables", 100], ["Onion", 30]],
  "masala-chiya": [["Milk", 150], ["Tea leaves", 4]],
  "mango-lassi": [["Yoghurt", 200], ["Mango pulp", 100]],
  "juju-dhau": [["Yoghurt", 250], ["Milk", 50]],
};

async function seedInventory(): Promise<void> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: DEMO_SLUG },
    include: { branches: { where: { isDefault: true } } },
  });
  const branch = restaurant?.branches[0];
  if (!restaurant || !branch) return;

  if ((await prisma.ingredient.count({ where: { branchId: branch.id } })) > 0) {
    console.info("Inventory already seeded — skipping");
    return;
  }

  const receivedAt = new Date(Date.now() - 2 * DAY_MS);
  const idByName = new Map<string, string>();

  for (const [name, unit, quantity, parLevel, cost] of INGREDIENTS) {
    const ingredient = await prisma.ingredient.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        name,
        unit,
        quantity,
        parLevel,
        lots: { create: { supplier: "Kalimati Suppliers", cost, quantity, remaining: quantity, receivedAt } },
        movements: { create: { delta: quantity, reason: "DELIVERY", supplier: "Kalimati Suppliers", cost, createdAt: receivedAt } },
      },
    });
    idByName.set(name, ingredient.id);
  }

  const totalCost = INGREDIENTS.reduce((sum, row) => sum + row[4], 0);
  await prisma.expense.create({
    data: {
      restaurantId: restaurant.id,
      branchId: branch.id,
      kind: "EXPENSE",
      amount: totalCost,
      category: "Stock",
      note: "Weekly produce and dry goods",
      createdAt: receivedAt,
      createdByName: "Bikash Rai",
    },
  });

  const dishes = await prisma.dish.findMany({ where: { branchId: branch.id } });
  const lines = dishes.flatMap(dish =>
    (RECIPES[dish.slug] ?? []).map(([name, quantity]) => ({ dishId: dish.id, ingredientId: idByName.get(name)!, quantity }))
  );
  await prisma.recipeLine.createMany({ data: lines });

  console.info(`Seeded ${INGREDIENTS.length} ingredients and ${lines.length} recipe lines`);
}

/* ── Delivery ──────────────────────────────────────────────────
   A partner that collects cash and takes a cut, a salaried rider and a
   per-delivery freelancer, ~30 days of delivery orders, and the states the
   screens care about: delivered + paid, delivered awaiting settlement (SETTLE),
   out on the road, and fresh tickets. Partner cash is settled in one bulk row. */

const CUSTOMERS = [
  { name: "Anil Maharjan", phone: "9841000001", address: "Kupondole, Lalitpur" },
  { name: "Rina Basnet", phone: "9841000002", address: "Baneshwor, Kathmandu" },
  { name: "Suman Thapa", phone: "9841000003", address: "Boudha, Kathmandu" },
  { name: "Pooja Joshi", phone: "9841000004", address: "Patan Dhoka, Lalitpur" },
  { name: "Kiran Adhikari", phone: "9841000005", address: "Lazimpat, Kathmandu" },
];

async function seedDelivery(): Promise<void> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: DEMO_SLUG },
    include: { branches: { where: { isDefault: true } } },
  });
  const branch = restaurant?.branches[0];
  if (!restaurant || !branch) return;

  const alreadySeeded = await prisma.order.count({
    where: { branchId: branch.id, idempotencyKey: { startsWith: `${SEED_MARKER}delivery:` } },
  });
  if (alreadySeeded > 0) {
    console.info(`Delivery already seeded (${alreadySeeded} orders) — skipping`);
    return;
  }

  const deliveryFee = 10000;
  await prisma.restaurant.update({ where: { id: restaurant.id }, data: { deliveryFeeAmount: deliveryFee } });

  const partner = await prisma.deliveryPartner.create({
    data: {
      restaurantId: restaurant.id,
      branchId: branch.id,
      name: "Swift Riders",
      phone: "+977-9801000000",
      contactPerson: "Manish Pandey",
      feeModel: "PERCENT",
      feeValue: 1200, // 12%
      collectsCash: true,
    },
  });
  const staffRider = await prisma.deliveryRider.create({
    data: { restaurantId: restaurant.id, branchId: branch.id, name: "Prakash Gurung", phone: "9801000001", kind: "STAFF", vehicle: "Honda Dio", payModel: "SALARIED" },
  });
  const freelancer = await prisma.deliveryRider.create({
    data: { restaurantId: restaurant.id, branchId: branch.id, name: "Dipesh Karki", phone: "9801000002", kind: "FREELANCE", vehicle: "Pulsar 150", payModel: "PER_DELIVERY", payValue: 8000 },
  });

  const customers: ((typeof CUSTOMERS)[number] & { id: string })[] = [];
  for (const entry of CUSTOMERS) {
    const customer = await prisma.customer.upsert({
      where: { phone: entry.phone },
      update: {},
      create: { phone: entry.phone, name: entry.name },
    });
    await prisma.customerRestaurant.upsert({
      where: { customerId_restaurantId: { customerId: customer.id, restaurantId: restaurant.id } },
      update: {},
      create: { customerId: customer.id, restaurantId: restaurant.id, defaultAddress: entry.address },
    });
    customers.push({ ...entry, id: customer.id });
  }

  const dishes = await prisma.dish.findMany({ where: { branchId: branch.id } });
  const random = mulberry32(20261012);
  const now = Date.now();
  let reference = 1000 + (await prisma.order.count({ where: { branchId: branch.id } }));

  // Oldest first. The last four are the live tickets; the two before them are delivered, unsettled.
  const TOTAL = 24;
  const partnerRuns: { total: number; fee: number; collected: number; at: Date }[] = [];

  for (let i = 0; i < TOTAL; i++) {
    const live = ["PENDING", "PREPARING", "OUT_FOR_DELIVERY"][i - (TOTAL - 3)] as string | undefined;
    const awaitingSettle = !live && i >= TOTAL - 5;
    const status = live ?? (awaitingSettle ? "SETTLE" : "COMPLETED");
    const placedAt = live
      ? new Date(now - (10 + i) * 60_000)
      : new Date(now - (TOTAL - i) * 1.2 * DAY_MS * (1 + random() * 0.1) - 3_600_000);
    const completedAt = new Date(placedAt.getTime() + 50 * 60_000);
    const customer = customers[Math.floor(random() * customers.length)];

    const picks = Array.from({ length: 1 + Math.floor(random() * 3) }, () => dishes[Math.floor(random() * dishes.length)]);
    const lines = [...new Map(picks.map(dish => [dish.id, dish])).values()].map(dish => ({ dish, quantity: 1 + Math.floor(random() * 2) }));
    const subtotal = lines.reduce((sum, line) => sum + line.dish.price * line.quantity, 0);
    const tax = Math.round(subtotal * restaurant.taxRate);
    const total = subtotal + tax + deliveryFee;
    const itemStatus = { PENDING: "PENDING", PREPARING: "PREPARING", OUT_FOR_DELIVERY: "READY" }[status as string] ?? "SERVED";

    reference += 1;
    const session = await prisma.diningSession.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        customerId: customer.id,
        anonymousSessionToken: `${SEED_MARKER}${randomBytes(18).toString("base64url")}`,
        startedAt: placedAt,
        expiresAt: new Date(placedAt.getTime() + 3 * 60 * 60_000),
        endedAt: status === "COMPLETED" ? completedAt : null,
      },
    });
    const order = await prisma.order.create({
      data: {
        reference: `#${reference}`,
        restaurantId: restaurant.id,
        branchId: branch.id,
        sessionId: session.id,
        customerId: customer.id,
        orderType: "DELIVERY",
        status: status as "PENDING",
        subtotal,
        tax,
        deliveryFee,
        total,
        currency: restaurant.currency,
        deliveryAddress: customer.address,
        deliveryPhone: customer.phone,
        deliveryCustomerName: customer.name,
        deliveryNote: random() < 0.3 ? "Call on arrival, gate is blue." : null,
        idempotencyKey: `${SEED_MARKER}delivery:${i}`,
        acceptedAt: status === "PENDING" ? null : new Date(placedAt.getTime() + 3 * 60_000),
        completedAt: status === "COMPLETED" ? completedAt : null,
        createdAt: placedAt,
        items: {
          create: lines.map(line => ({
            dishId: line.dish.id,
            dishNameSnapshot: line.dish.name,
            imageUrlSnapshot: line.dish.imageUrl,
            unitPrice: line.dish.price,
            quantity: line.quantity,
            status: itemStatus as "SERVED",
            createdAt: placedAt,
          })),
        },
      },
    });

    if (status === "PENDING" || status === "PREPARING") continue;

    // Alternate runs between the partner and the two riders.
    const lane = i % 3; // 0 partner, 1 staff rider, 2 freelancer
    const courierFee = lane === 0 ? Math.round((total * partner.feeValue) / 10000) : lane === 2 ? freelancer.payValue : 0;
    const delivered = status !== "OUT_FOR_DELIVERY";
    // One run comes back short so the "short cash" state is visible.
    const collected = delivered ? (i === 5 ? total - 5000 : total) : null;
    const rider = lane === 1 ? staffRider : lane === 2 ? freelancer : null;

    await prisma.deliveryAssignment.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        orderId: order.id,
        orderRef: order.reference,
        customerName: customer.name,
        orderTotal: total,
        riderId: rider?.id,
        partnerId: lane === 0 ? partner.id : null,
        riderName: rider?.name,
        partnerName: lane === 0 ? partner.name : null,
        accountKind: lane === 0 ? "PARTNER" : "RIDER",
        accountId: lane === 0 ? partner.id : rider!.id,
        status: delivered ? "DELIVERED" : "ASSIGNED",
        assignedAt: new Date(placedAt.getTime() + 8 * 60_000),
        deliveredAt: delivered ? completedAt : null,
        courierFee,
        cashToCollect: total,
        cashCollected: collected,
      },
    });
    if (lane === 0 && delivered && status === "COMPLETED" && collected !== null) {
      partnerRuns.push({ total, fee: courierFee, collected, at: completedAt });
    }

    if (status === "COMPLETED") {
      await prisma.payment.create({
        data: {
          restaurantId: restaurant.id,
          branchId: branch.id,
          sessionId: session.id,
          customerId: customer.id,
          subtotal,
          serviceCharge: 0,
          tax,
          total,
          method: "CASH",
          paidAmount: total,
          paymentStatus: "PAID",
          tenders: { create: { restaurantId: restaurant.id, branchId: branch.id, amount: total, method: "CASH", paidAt: completedAt, createdAt: completedAt } },
          currency: restaurant.currency,
          createdAt: completedAt,
          createdByName: "Sunita Tamang",
          items: { create: lines.map(line => ({ dishId: line.dish.id, dishNameSnapshot: line.dish.name, unitPrice: line.dish.price, quantity: line.quantity, createdAt: completedAt })) },
        },
      });
    }
  }

  // The partner's older runs, settled in one bulk row: cash handed over, net of its fees.
  const settled = partnerRuns.slice(0, Math.max(0, partnerRuns.length - 1));
  if (settled.length) {
    const cash = settled.reduce((sum, run) => sum + run.collected, 0);
    const fees = settled.reduce((sum, run) => sum + run.fee, 0);
    const settlement = await prisma.deliverySettlement.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        accountKind: "PARTNER",
        accountId: partner.id,
        direction: "COLLECT",
        amount: cash - fees,
        offset: fees,
        method: "CASH",
        note: "Weekly cash-up with Swift Riders",
        createdByName: "Bikash Rai",
      },
    });
    await prisma.expense.create({
      data: {
        restaurantId: restaurant.id,
        branchId: branch.id,
        kind: "INCOME",
        amount: cash - fees,
        category: "Courier settlement",
        deliverySettlementId: settlement.id,
        createdByName: "Bikash Rai",
      },
    });
  }

  console.info(`Seeded ${TOTAL} delivery orders, 1 partner, 2 riders, ${customers.length} customers`);
}

/* ── Delivery quality ──────────────────────────────────────────
   The Watchlist traces a review back through its order line to the stock lot
   that fed it (review → order + dish → LotConsumption → StockLot). The history
   above has reviews but no lot trail, so this gives the main ingredient of each
   reviewed dish a couple of past deliveries and links every review to one:
     - Chicken: a bad batch from one supplier drags Chicken Sekuwa down → flagged
     - Buffalo meat: a tiny recent batch with one poor review → too few to judge
     - Paneer, Mixed vegetables: steady deliveries → normal
   Poor reviews (taste/overall ≤ 2) are written onto existing seeded reviews, so
   the dish's own rating moves with them. Earlier deliveries are priced a little
   lower than the current stock, so the margin page shows costs creeping up.   */

interface LotStory {
  dish: string;
  ingredient: string;
  /** Oldest first. `perUnit` is minor units per g/ml; the last lot takes whatever reviews remain. */
  lots: { supplier: string; reviews: number; poor: number; perUnit: number }[];
}

const LOT_STORIES: LotStory[] = [
  {
    dish: "chicken-sekuwa",
    ingredient: "Chicken",
    lots: [
      { supplier: "Balaju Poultry", reviews: 21, poor: 1, perUnit: 0.42 },
      { supplier: "Kalimati Suppliers", reviews: 13, poor: 6, perUnit: 0.45 },
    ],
  },
  {
    dish: "buff-steam-momo",
    ingredient: "Buffalo meat",
    lots: [
      { supplier: "Kalimati Suppliers", reviews: 15, poor: 1, perUnit: 0.55 },
      { supplier: "Teku Meat Market", reviews: 3, poor: 1, perUnit: 0.58 },
    ],
  },
  {
    dish: "paneer-sekuwa",
    ingredient: "Paneer",
    lots: [
      { supplier: "Dairy Development Corp.", reviews: 8, poor: 0, perUnit: 1.2 },
      { supplier: "Local Dairy", reviews: 6, poor: 0, perUnit: 1.25 },
    ],
  },
  {
    dish: "veg-jhol-momo",
    ingredient: "Mixed vegetables",
    lots: [
      { supplier: "Kalimati Suppliers", reviews: 6, poor: 0, perUnit: 0.06 },
      { supplier: "Kalimati Suppliers", reviews: 6, poor: 0, perUnit: 0.065 },
    ],
  },
];

const POOR_COMMENTS = [
  "Chicken tasted a bit off today, not as fresh as usual.",
  "Rubbery and bland. Different from last time.",
  "Smelled funny when it arrived. Sent half back.",
  "Not up to the usual standard.",
];

async function seedLotQuality(): Promise<void> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { slug: DEMO_SLUG },
    include: { branches: { where: { isDefault: true } } },
  });
  const branch = restaurant?.branches[0];
  if (!restaurant || !branch) return;

  // Live orders also consume lots, so "already seeded" means these story suppliers, not any consumption.
  const seededLots = await prisma.stockLot.count({
    where: { ingredient: { branchId: branch.id }, supplier: { in: LOT_STORIES.flatMap(story => story.lots.map(lot => lot.supplier)) }, remaining: 0 },
  });
  if (seededLots > 0) {
    console.info("Delivery quality already seeded — skipping");
    return;
  }

  let linked = 0;
  let poorWritten = 0;

  for (const story of LOT_STORIES) {
    const ingredient = await prisma.ingredient.findUnique({ where: { branchId_name: { branchId: branch.id, name: story.ingredient } } });
    const dish = await prisma.dish.findUnique({ where: { branchId_slug: { branchId: branch.id, slug: story.dish } } });
    if (!ingredient || !dish) continue;
    const perServing = RECIPES[story.dish]?.find(([name]) => name === story.ingredient)?.[1] ?? 0;

    const reviews = await prisma.dishReview.findMany({
      where: { restaurantId: restaurant.id, dishId: dish.id },
      orderBy: { createdAt: "asc" },
      include: { order: { select: { createdAt: true, items: { where: { dishId: dish.id }, select: { id: true, quantity: true } } } } },
    });
    if (reviews.length === 0) continue;

    let from = 0;
    for (const [lotIndex, plan] of story.lots.entries()) {
      const isLast = lotIndex === story.lots.length - 1;
      const group = reviews.slice(from, isLast ? undefined : from + plan.reviews);
      from += group.length;
      if (group.length === 0) continue;

      // Poor reviews spread evenly through the group, the way a bad batch actually shows up.
      const poorAt = new Set(Array.from({ length: Math.min(plan.poor, group.length) }, (_, k) => Math.floor(((k + 0.5) * group.length) / plan.poor)));

      const uses = group.flatMap(review => review.order.items.map(item => ({ review, item, quantity: perServing * item.quantity })));
      const quantity = uses.reduce((sum, use) => sum + use.quantity, 0);
      const receivedAt = new Date(group[0].order.createdAt.getTime() - DAY_MS);

      // Fully used up already — the stock on the shelf is the newer opening lot.
      const lot = await prisma.stockLot.create({
        data: { ingredientId: ingredient.id, supplier: plan.supplier, cost: Math.round(quantity * plan.perUnit), quantity, remaining: 0, receivedAt },
      });
      await prisma.lotConsumption.createMany({
        data: uses.map(use => ({ lotId: lot.id, orderItemId: use.item.id, quantity: use.quantity, createdAt: use.review.order.createdAt })),
      });
      linked += uses.length;

      for (const [index, review] of group.entries()) {
        if (!poorAt.has(index)) continue;
        await prisma.dishReview.update({
          where: { id: review.id },
          data: { overall: 2, taste: 2, wouldOrderAgain: false, comment: POOR_COMMENTS[index % POOR_COMMENTS.length] },
        });
        poorWritten += 1;
      }
    }

    // The shelf stock is the latest delivery, so the earlier ones above read as the "before" price.
    await prisma.stockLot.updateMany({ where: { ingredientId: ingredient.id, remaining: { gt: 0 } }, data: { receivedAt: new Date() } });
  }

  console.info(`Traced ${linked} order lines to past deliveries; ${poorWritten} poor reviews written`);
}

async function main(): Promise<void> {
  await seedReviewTags();
  if (process.env.SEED_DEMO === "false") return;

  // await seedDemoRestaurant();
  // SEED_HISTORY=false keeps the demo restaurant empty — useful for looking at
  // the app's own empty states.
  // if (process.env.SEED_HISTORY !== "false") {
  //   await seedTradingHistory();
  //   await seedDelivery();
  // }
  // await seedInventory();
  // if (process.env.SEED_HISTORY !== "false") await seedLotQuality();
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
