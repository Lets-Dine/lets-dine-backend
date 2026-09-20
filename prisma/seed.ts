// import { randomBytes, scryptSync } from "node:crypto";
// import { PrismaClient, StaffRole } from "@prisma/client";

// const prisma = new PrismaClient();

// /** §9 — the fixed review vocabulary. Free text lives in the comment; tags stay countable. */
// const REVIEW_TAGS = [
//   "Delicious",
//   "Spicy",
//   "Mild",
//   "Crispy",
//   "Juicy",
//   "Fresh",
//   "Large portion",
//   "Small portion",
//   "Good value",
//   "Expensive",
//   "Great presentation",
//   "Kid friendly",
// ];

// const DEMO_PIN = process.env.SEED_DEMO_PIN ?? "4821";

// function hashPin(pin: string): string {
//   const salt = randomBytes(16).toString("hex");
//   return `${salt}:${scryptSync(pin, salt, 64).toString("hex")}`;
// }

// function qrToken(): string {
//   return randomBytes(24).toString("base64url");
// }

// async function seedReviewTags(): Promise<void> {
//   await Promise.all(
//     REVIEW_TAGS.map((label, sortOrder) =>
//       prisma.dishTag.upsert({ where: { label }, update: { sortOrder }, create: { label, sortOrder } })
//     )
//   );
//   console.info(`Seeded ${REVIEW_TAGS.length} review tags`);
// }

// /** A restaurant you can actually sign into, so the API is explorable straight after a migrate. */
// async function seedDemoRestaurant(): Promise<void> {
//   const restaurant = await prisma.restaurant.upsert({
//     where: { slug: "newa-kitchen" },
//     update: {},
//     create: {
//       name: "Newa Kitchen",
//       slug: "newa-kitchen",
//       tagline: "Kathmandu classics, cooked to order",
//       description: "Charcoal grill, momo steamers and a chiya counter that never closes.",
//       currency: "NPR",
//       timezone: "Asia/Kathmandu",
//       serviceChargeRate: 0.1,
//       taxRate: 0.13,
//     },
//   });

//   const staff: { name: string; email: string; role: StaffRole }[] = [
//     { name: "Aarati Shrestha", email: "owner@lets-dine.test", role: StaffRole.OWNER },
//     { name: "Bikash Rai", email: "manager@lets-dine.test", role: StaffRole.MANAGER },
//     { name: "Sunita Tamang", email: "staff@lets-dine.test", role: StaffRole.STAFF },
//   ];

//   for (const member of staff) {
//     const user = await prisma.user.upsert({
//       where: { email: member.email },
//       update: {},
//       create: { email: member.email, name: member.name, pinHash: hashPin(DEMO_PIN) },
//     });

//     await prisma.restaurantMember.upsert({
//       where: { restaurantId_userId: { restaurantId: restaurant.id, userId: user.id } },
//       update: { role: member.role },
//       create: { restaurantId: restaurant.id, userId: user.id, role: member.role },
//     });
//   }

//   for (const [index, name] of ["T1", "T2", "T3", "Window 1"].entries()) {
//     await prisma.diningTable.upsert({
//       where: { restaurantId_name: { restaurantId: restaurant.id, name } },
//       update: {},
//       create: { restaurantId: restaurant.id, name, qrToken: qrToken(), capacity: 4, sortOrder: index },
//     });
//   }

//   const menu: { category: string; emoji: string; dishes: { name: string; price: number; isVeg: boolean; spiceLevel: number }[] }[] = [
//     {
//       category: "From the grill",
//       emoji: "🔥",
//       dishes: [
//         { name: "Chicken Sekuwa", price: 45000, isVeg: false, spiceLevel: 2 },
//         { name: "Paneer Sekuwa", price: 39000, isVeg: true, spiceLevel: 1 },
//       ],
//     },
//     {
//       category: "Momo",
//       emoji: "🥟",
//       dishes: [
//         { name: "Buff Steam Momo", price: 28000, isVeg: false, spiceLevel: 1 },
//         { name: "Veg Jhol Momo", price: 26000, isVeg: true, spiceLevel: 2 },
//       ],
//     },
//   ];

//   for (const [categoryIndex, section] of menu.entries()) {
//     const category = await prisma.menuCategory.upsert({
//       where: { restaurantId_name: { restaurantId: restaurant.id, name: section.category } },
//       update: { emoji: section.emoji, sortOrder: categoryIndex },
//       create: {
//         restaurantId: restaurant.id,
//         name: section.category,
//         emoji: section.emoji,
//         sortOrder: categoryIndex,
//       },
//     });

//     for (const [dishIndex, dish] of section.dishes.entries()) {
//       const slug = dish.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
//       await prisma.dish.upsert({
//         where: { restaurantId_slug: { restaurantId: restaurant.id, slug } },
//         update: { price: dish.price },
//         create: {
//           restaurantId: restaurant.id,
//           categoryId: category.id,
//           name: dish.name,
//           slug,
//           price: dish.price,
//           isVeg: dish.isVeg,
//           spiceLevel: dish.spiceLevel,
//           sortOrder: dishIndex,
//         },
//       });
//     }
//   }

//   console.info(`Seeded demo restaurant "${restaurant.name}" — sign in with any of ${staff.map(member => member.email).join(", ")} and PIN ${DEMO_PIN}`);
// }

// /* ── Trading history ───────────────────────────────────────────
//    §9/§12/§48: every number the diner app shows — the recommend rate, the
//    sub-scores, the badges, the rails — is gated on having enough evidence
//    behind it. A restaurant with four dishes and no orders renders as "Not
//    rated yet" everywhere, which makes the discovery half of the product look
//    broken rather than empty. So the demo restaurant gets a plausible two
//    months of trading: completed orders spread across both 30-day windows,
//    and reviews with the spread of opinion those thresholds exist to weigh.  */

// const DAY_MS = 24 * 60 * 60 * 1000;
// const SEED_MARKER = "seed:";

// /** Deterministic PRNG, so reseeding twice produces the same restaurant. */
// function mulberry32(seed: number): () => number {
//   let a = seed;
//   return () => {
//     a = (a + 0x6d2b79f5) | 0;
//     let t = Math.imul(a ^ (a >>> 15), 1 | a);
//     t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
//     return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
//   };
// }

// interface DishHistory {
//   slug: string;
//   /** Units sold in the trailing 30 days, and in the 30 before that (§12). */
//   unitsLast30: number;
//   unitsPrev30: number;
//   reviewCount: number;
//   /** Sampled for each review — its mean is what the dish ends up rated. */
//   ratingBag: number[];
//   /** Nudges the "value for money" sub-score away from the overall star. */
//   valueBias: number;
//   wouldOrderAgainRate: number;
//   comments: string[];
//   tags: string[];
// }

// /** One profile per badge the merchandising rules can award, so each is reachable. */
// const DISH_HISTORY: DishHistory[] = [
//   {
//     // The hit: sells enough to be "popular" and is rated well enough to be "loved".
//     slug: "chicken-sekuwa",
//     unitsLast30: 168,
//     unitsPrev30: 126,
//     reviewCount: 34,
//     ratingBag: [5, 5, 5, 5, 4, 4, 5, 4],
//     valueBias: 0,
//     wouldOrderAgainRate: 0.88,
//     comments: [
//       "Charred exactly right, still juicy inside.",
//       "Ordered this twice in one sitting. No regrets.",
//       "The marinade is the whole thing. Ask for extra achar.",
//       "Better than the sekuwa place near my office, honestly.",
//     ],
//     tags: ["Juicy", "Spicy", "Delicious"],
//   },
//   {
//     // Steady seller, priced kindly — the "good value" case.
//     slug: "buff-steam-momo",
//     unitsLast30: 66,
//     unitsPrev30: 60,
//     reviewCount: 18,
//     ratingBag: [5, 4, 4, 4, 5, 4, 3, 5],
//     valueBias: 0.6,
//     wouldOrderAgainRate: 0.78,
//     comments: [
//       "Ten pieces for this price is a steal.",
//       "Solid momo. The jhol on the side is the move.",
//       "Wrappers were a bit thick but the filling is good.",
//     ],
//     tags: ["Good value", "Large portion", "Fresh"],
//   },
//   {
//     // Climbing fast: this window well ahead of the last — "trending".
//     slug: "veg-jhol-momo",
//     unitsLast30: 58,
//     unitsPrev30: 26,
//     reviewCount: 12,
//     ratingBag: [5, 5, 4, 4, 5, 4, 4, 5],
//     valueBias: 0.2,
//     wouldOrderAgainRate: 0.83,
//     comments: [
//       "The jhol is properly sour and hot. Drink the leftovers.",
//       "Did not miss the meat at all.",
//       "Came out steaming. Perfect for the weather.",
//     ],
//     tags: ["Spicy", "Fresh", "Delicious"],
//   },
//   {
//     // Quietly excellent and under-ordered — the "hidden gem".
//     slug: "paneer-sekuwa",
//     unitsLast30: 38,
//     unitsPrev30: 31,
//     reviewCount: 14,
//     ratingBag: [5, 5, 5, 5, 4, 5, 5, 4],
//     valueBias: -0.2,
//     wouldOrderAgainRate: 0.9,
//     comments: [
//       "Nobody orders this and I do not understand why.",
//       "Smokier than I expected. Excellent.",
//       "The paneer stays soft, which is the hard part.",
//     ],
//     tags: ["Delicious", "Great presentation", "Mild"],
//   },
// ];

// const clampStar = (value: number) => Math.min(5, Math.max(1, Math.round(value)));

// async function seedTradingHistory(): Promise<void> {
//   const restaurant = await prisma.restaurant.findUnique({ where: { slug: "newa-kitchen" } });
//   if (!restaurant) return;

//   const alreadySeeded = await prisma.order.count({
//     where: { restaurantId: restaurant.id, idempotencyKey: { startsWith: SEED_MARKER } },
//   });
//   if (alreadySeeded > 0) {
//     console.info(`Trading history already seeded (${alreadySeeded} orders) — skipping`);
//     return;
//   }

//   const [tables, dishes, tags] = await Promise.all([
//     prisma.diningTable.findMany({ where: { restaurantId: restaurant.id }, orderBy: { sortOrder: "asc" } }),
//     prisma.dish.findMany({ where: { restaurantId: restaurant.id } }),
//     prisma.dishTag.findMany(),
//   ]);
//   const tagIdByLabel = new Map(tags.map(tag => [tag.label, tag.id]));

//   const random = mulberry32(20260913);
//   const now = Date.now();
//   let reference = 1000 + (await prisma.order.count({ where: { restaurantId: restaurant.id } }));
//   let orders = 0;
//   let reviews = 0;

//   for (const profile of DISH_HISTORY) {
//     const dish = dishes.find(candidate => candidate.slug === profile.slug);
//     if (!dish) continue;

//     // Each window is filled to its unit target, so orders30d / ordersPrev30d —
//     // and therefore the velocity ratio behind "trending" — land where intended.
//     const placements: { placedAt: Date; quantity: number }[] = [];
//     for (const [windowIndex, target] of [profile.unitsLast30, profile.unitsPrev30].entries()) {
//       const windowEnd = now - windowIndex * 30 * DAY_MS;
//       let units = 0;
//       while (units < target) {
//         const quantity = Math.min(1 + Math.floor(random() * 3), target - units);
//         placements.push({
//           placedAt: new Date(windowEnd - random() * 30 * DAY_MS - 60_000),
//           quantity,
//         });
//         units += quantity;
//       }
//     }
//     placements.sort((a, b) => a.placedAt.getTime() - b.placedAt.getTime());

//     // Reviews land on the most recent visits, the way real feedback does.
//     const reviewedFrom = Math.max(0, placements.length - profile.reviewCount);

//     for (const [index, placement] of placements.entries()) {
//       const table = tables[Math.floor(random() * tables.length)];
//       const subtotal = dish.price * placement.quantity;
//       const serviceCharge = Math.round(subtotal * restaurant.serviceChargeRate);
//       const tax = Math.round((subtotal + serviceCharge) * restaurant.taxRate);
//       const completedAt = new Date(placement.placedAt.getTime() + 40 * 60_000);

//       reference += 1;

//       const session = await prisma.diningSession.create({
//         data: {
//           restaurantId: restaurant.id,
//           tableId: table.id,
//           anonymousSessionToken: `${SEED_MARKER}${randomBytes(18).toString("base64url")}`,
//           startedAt: placement.placedAt,
//           expiresAt: new Date(placement.placedAt.getTime() + 3 * 60 * 60_000),
//           endedAt: completedAt,
//         },
//       });

//       const order = await prisma.order.create({
//         data: {
//           reference: `#${reference}`,
//           restaurantId: restaurant.id,
//           tableId: table.id,
//           sessionId: session.id,
//           status: "COMPLETED",
//           subtotal,
//           serviceCharge,
//           tax,
//           discount: 0,
//           total: subtotal + serviceCharge + tax,
//           currency: restaurant.currency,
//           idempotencyKey: `${SEED_MARKER}${dish.slug}:${index}`,
//           createdAt: placement.placedAt,
//           completedAt,
//           items: {
//             create: {
//               dishId: dish.id,
//               dishNameSnapshot: dish.name,
//               imageUrlSnapshot: dish.imageUrl,
//               unitPrice: dish.price,
//               quantity: placement.quantity,
//               createdAt: placement.placedAt,
//             },
//           },
//         },
//       });
//       orders += 1;

//       if (index < reviewedFrom) continue;

//       const overall = profile.ratingBag[Math.floor(random() * profile.ratingBag.length)];
//       const reviewTags = profile.tags.filter(() => random() < 0.5).slice(0, 2);
//       const comment = random() < 0.45 ? profile.comments[Math.floor(random() * profile.comments.length)] : "";

//       await prisma.dishReview.create({
//         data: {
//           restaurantId: restaurant.id,
//           dishId: dish.id,
//           orderId: order.id,
//           sessionId: session.id,
//           overall,
//           taste: clampStar(overall + (random() < 0.3 ? 1 : 0) - (random() < 0.2 ? 1 : 0)),
//           portion: clampStar(overall - (random() < 0.35 ? 1 : 0)),
//           value: clampStar(overall + profile.valueBias + (random() < 0.25 ? 1 : -0.4)),
//           wouldOrderAgain: random() < profile.wouldOrderAgainRate,
//           comment,
//           createdAt: new Date(completedAt.getTime() + 25 * 60_000),
//           ...(reviewTags.length && {
//             tags: {
//               create: reviewTags
//                 .map(label => tagIdByLabel.get(label))
//                 .filter((id): id is string => Boolean(id))
//                 .map(tagId => ({ tagId })),
//             },
//           }),
//         },
//       });
//       reviews += 1;
//     }
//   }

//   console.info(`Seeded ${orders} completed orders and ${reviews} reviews across the last 60 days`);
// }

// async function main(): Promise<void> {
//   await seedReviewTags();
//   if (process.env.SEED_DEMO === "false") return;

//   await seedDemoRestaurant();
//   // SEED_HISTORY=false keeps the demo restaurant empty — useful for looking at
//   // the app's own empty states.
//   if (process.env.SEED_HISTORY !== "false") await seedTradingHistory();
// }

// main()
//   .catch(error => {
//     console.error(error);
//     process.exitCode = 1;
//   })
//   .finally(() => prisma.$disconnect());
