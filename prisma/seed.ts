import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient, StaffRole } from "@prisma/client";

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

/** A restaurant you can actually sign into, so the API is explorable straight after a migrate. */
async function seedDemoRestaurant(): Promise<void> {
  const restaurant = await prisma.restaurant.upsert({
    where: { slug: "newa-kitchen" },
    update: {},
    create: {
      name: "Newa Kitchen",
      slug: "newa-kitchen",
      tagline: "Kathmandu classics, cooked to order",
      description: "Charcoal grill, momo steamers and a chiya counter that never closes.",
      currency: "NPR",
      timezone: "Asia/Kathmandu",
      serviceChargeRate: 0.1,
      taxRate: 0.13,
    },
  });

  const staff: { name: string; email: string; role: StaffRole }[] = [
    { name: "Aarati Shrestha", email: "owner@lets-dine.test", role: StaffRole.OWNER },
    { name: "Bikash Rai", email: "manager@lets-dine.test", role: StaffRole.MANAGER },
    { name: "Sunita Tamang", email: "staff@lets-dine.test", role: StaffRole.STAFF },
  ];

  for (const member of staff) {
    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: {},
      create: { email: member.email, name: member.name, pinHash: hashPin(DEMO_PIN) },
    });

    await prisma.restaurantMember.upsert({
      where: { restaurantId_userId: { restaurantId: restaurant.id, userId: user.id } },
      update: { role: member.role },
      create: { restaurantId: restaurant.id, userId: user.id, role: member.role },
    });
  }

  for (const [index, name] of ["T1", "T2", "T3", "Window 1"].entries()) {
    await prisma.diningTable.upsert({
      where: { restaurantId_name: { restaurantId: restaurant.id, name } },
      update: {},
      create: { restaurantId: restaurant.id, name, qrToken: qrToken(), capacity: 4, sortOrder: index },
    });
  }

  const menu: { category: string; emoji: string; dishes: { name: string; price: number; isVeg: boolean; spiceLevel: number }[] }[] = [
    {
      category: "From the grill",
      emoji: "🔥",
      dishes: [
        { name: "Chicken Sekuwa", price: 45000, isVeg: false, spiceLevel: 2 },
        { name: "Paneer Sekuwa", price: 39000, isVeg: true, spiceLevel: 1 },
      ],
    },
    {
      category: "Momo",
      emoji: "🥟",
      dishes: [
        { name: "Buff Steam Momo", price: 28000, isVeg: false, spiceLevel: 1 },
        { name: "Veg Jhol Momo", price: 26000, isVeg: true, spiceLevel: 2 },
      ],
    },
  ];

  for (const [categoryIndex, section] of menu.entries()) {
    const category = await prisma.menuCategory.upsert({
      where: { restaurantId_name: { restaurantId: restaurant.id, name: section.category } },
      update: { emoji: section.emoji, sortOrder: categoryIndex },
      create: {
        restaurantId: restaurant.id,
        name: section.category,
        emoji: section.emoji,
        sortOrder: categoryIndex,
      },
    });

    for (const [dishIndex, dish] of section.dishes.entries()) {
      const slug = dish.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      await prisma.dish.upsert({
        where: { restaurantId_slug: { restaurantId: restaurant.id, slug } },
        update: { price: dish.price },
        create: {
          restaurantId: restaurant.id,
          categoryId: category.id,
          name: dish.name,
          slug,
          price: dish.price,
          isVeg: dish.isVeg,
          spiceLevel: dish.spiceLevel,
          sortOrder: dishIndex,
        },
      });
    }
  }

  console.info(`Seeded demo restaurant "${restaurant.name}" — sign in with any of ${staff.map(member => member.email).join(", ")} and PIN ${DEMO_PIN}`);
}

async function main(): Promise<void> {
  await seedReviewTags();
  if (process.env.SEED_DEMO !== "false") await seedDemoRestaurant();
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
