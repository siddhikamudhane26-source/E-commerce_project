import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import {
  categoriesTable,
  customerActivityTable,
  customersTable,
  db,
  orderItemsTable,
  ordersTable,
  paymentsTable,
  productsTable,
  recommendationsTable,
  reviewsTable,
  wishlistTable,
} from "@workspace/db";
import { logger } from "./logger";

const productImages = {
  electronics: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85",
  fashion: "https://images.unsplash.com/photo-1445205170230-053b83016050?auto=format&fit=crop&w=900&q=85",
  books: "https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=900&q=85",
  beauty: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&w=900&q=85",
  home: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=85",
  lifestyle: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=85",
};

type SeedProduct = {
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number;
  category: string;
  tags: string[];
  badge: string | null;
  image: keyof typeof productImages;
};

const seedProducts: SeedProduct[] = [
  { name: "Wireless Headphones", slug: "wireless-headphones", description: "Comfortable over-ear wireless headphones with active noise cancellation and a  thirty-hour battery.", price: 129, compareAtPrice: 159, category: "electronics", tags: ["audio", "focus", "travel"], badge: "Best seller", image: "electronics" },
  { name: "Smart Watch", slug: "smart-watch", description: "A slim smart watch with fitness tracking, sleep insights, and a bright all-day display.", price: 179, compareAtPrice: 219, category: "electronics", tags: ["fitness", "connected", "everyday"], badge: "New", image: "electronics" },
  { name: "Bluetooth Speaker", slug: "bluetooth-speaker", description: "A compact room-filling Bluetooth speaker with warm sound and twelve hours of playtime.", price: 79, compareAtPrice: 99, category: "electronics", tags: ["audio", "home", "portable"], badge: "Popular", image: "electronics" },
  { name: "Wireless Mouse", slug: "wireless-mouse", description: "A quiet ergonomic wireless mouse shaped for long creative and study sessions.", price: 34, compareAtPrice: 45, category: "electronics", tags: ["workspace", "focus", "ergonomic"], badge: null, image: "electronics" },
  { name: "Mechanical Keyboard", slug: "mechanical-keyboard", description: "A tactile compact mechanical keyboard with quiet switches and a satisfying weighted feel.", price: 109, compareAtPrice: 139, category: "electronics", tags: ["workspace", "focus", "desk"], badge: "Staff favorite", image: "electronics" },
  { name: "Power Bank", slug: "power-bank", description: "A pocket-sized fast-charging power bank with USB-C input and enough power for a full day.", price: 42, compareAtPrice: 55, category: "electronics", tags: ["travel", "portable", "utility"], badge: null, image: "electronics" },
  { name: "USB-C Hub", slug: "usb-c-hub", description: "A brushed aluminium USB-C hub with HDMI, card reader, and three high-speed USB ports.", price: 52, compareAtPrice: 68, category: "electronics", tags: ["workspace", "utility", "connected"], badge: null, image: "electronics" },
  { name: "Smart LED Bulb", slug: "smart-led-bulb", description: "A warm-to-cool smart LED bulb that lets you set the mood from your phone or voice assistant.", price: 24, compareAtPrice: 32, category: "electronics", tags: ["home", "connected", "light"], badge: null, image: "electronics" },
  { name: "Denim Jacket", slug: "denim-jacket", description: "A softly structured denim jacket with a slightly oversized cut for everyday layering.", price: 88, compareAtPrice: 120, category: "fashion", tags: ["layering", "everyday", "cotton"], badge: "New", image: "fashion" },
  { name: "Oversized T-Shirt", slug: "oversized-t-shirt", description: "A heavyweight organic cotton T-shirt with a relaxed fit and clean ribbed collar.", price: 32, compareAtPrice: 42, category: "fashion", tags: ["cotton", "everyday", "basics"], badge: null, image: "fashion" },
  { name: "Everyday Hoodie", slug: "everyday-hoodie", description: "A soft brushed-fleece hoodie with a generous hood and a considered neutral palette.", price: 64, compareAtPrice: 82, category: "fashion", tags: ["comfort", "layering", "everyday"], badge: "Popular", image: "fashion" },
  { name: "Casual Linen Shirt", slug: "casual-linen-shirt", description: "A breathable linen shirt that keeps its shape from desk hours to late dinners.", price: 58, compareAtPrice: 76, category: "fashion", tags: ["linen", "summer", "smart-casual"], badge: null, image: "fashion" },
  { name: "Cloud Sneakers", slug: "cloud-sneakers", description: "Lightweight everyday sneakers with a sculpted sole and breathable knit upper.", price: 96, compareAtPrice: 128, category: "fashion", tags: ["everyday", "lightweight", "walking"], badge: "Best seller", image: "fashion" },
  { name: "Relaxed Straight Jeans", slug: "relaxed-straight-jeans", description: "Mid-rise straight jeans in washed organic denim with a comfortable all-day fit.", price: 72, compareAtPrice: 94, category: "fashion", tags: ["denim", "everyday", "basics"], badge: null, image: "fashion" },
  { name: "Structured Handbag", slug: "structured-handbag", description: "A softly structured handbag with a magnetic closure and room for your daily essentials.", price: 118, compareAtPrice: 150, category: "fashion", tags: ["accessories", "everyday", "giftable"], badge: null, image: "fashion" },
  { name: "Canvas Daypack", slug: "canvas-daypack", description: "A durable canvas backpack with a padded laptop sleeve and comfortable wide straps.", price: 84, compareAtPrice: 105, category: "fashion", tags: ["travel", "workspace", "utility"], badge: null, image: "fashion" },
  { name: "Python Programming", slug: "python-programming", description: "A practical introduction to Python programming with clear examples and guided projects.", price: 42, compareAtPrice: 52, category: "books", tags: ["technology", "learning", "python"], badge: "Popular", image: "books" },
  { name: "Data Structures and Algorithms", slug: "data-structures-algorithms", description: "A visual, approachable guide to data structures, algorithms, and problem solving.", price: 48, compareAtPrice: 60, category: "books", tags: ["technology", "learning", "algorithms"], badge: "Staff favorite", image: "books" },
  { name: "Java Programming", slug: "java-programming", description: "Build a strong foundation in Java programming through examples, exercises, and patterns.", price: 39, compareAtPrice: 49, category: "books", tags: ["technology", "learning", "java"], badge: null, image: "books" },
  { name: "Database Management Systems", slug: "database-management-systems", description: "Learn relational modeling, SQL, normalization, transactions, and practical database design.", price: 46, compareAtPrice: 58, category: "books", tags: ["technology", "sql", "learning"], badge: null, image: "books" },
  { name: "Operating Systems", slug: "operating-systems", description: "A clear guide to processes, memory, file systems, concurrency, and operating system design.", price: 44, compareAtPrice: 55, category: "books", tags: ["technology", "systems", "learning"], badge: null, image: "books" },
  { name: "Computer Networks", slug: "computer-networks", description: "Understand the internet from packets and protocols to wireless networks and security.", price: 41, compareAtPrice: 54, category: "books", tags: ["technology", "networks", "learning"], badge: null, image: "books" },
  { name: "Artificial Intelligence", slug: "artificial-intelligence", description: "A friendly introduction to modern artificial intelligence, search, learning, and ethics.", price: 51, compareAtPrice: 64, category: "books", tags: ["technology", "ai", "learning"], badge: "New", image: "books" },
  { name: "Machine Learning", slug: "machine-learning", description: "Learn the core ideas behind machine learning models, evaluation, and real-world applications.", price: 56, compareAtPrice: 69, category: "books", tags: ["technology", "ai", "learning"], badge: null, image: "books" },
  { name: "Gentle Face Wash", slug: "gentle-face-wash", description: "A low-foam face wash with oat extract for a fresh, comfortable daily cleanse.", price: 18, compareAtPrice: 24, category: "beauty", tags: ["skincare", "gentle", "daily"], badge: "Best seller", image: "beauty" },
  { name: "Daily Moisturizer", slug: "daily-moisturizer", description: "A lightweight moisturizer with ceramides and squalane for calm, balanced skin.", price: 26, compareAtPrice: 34, category: "beauty", tags: ["skincare", "hydration", "daily"], badge: null, image: "beauty" },
  { name: "Mineral Sunscreen", slug: "mineral-sunscreen", description: "A sheer mineral SPF 50 that layers comfortably under makeup and daily essentials.", price: 22, compareAtPrice: 29, category: "beauty", tags: ["skincare", "spf", "outdoors"], badge: "Popular", image: "beauty" },
  { name: "Botanical Shampoo", slug: "botanical-shampoo", description: "A gentle botanical shampoo with rosemary and aloe for a clean, fresh scalp.", price: 20, compareAtPrice: 27, category: "beauty", tags: ["haircare", "botanical", "daily"], badge: null, image: "beauty" },
  { name: "Silk Conditioner", slug: "silk-conditioner", description: "A smoothing conditioner with argan oil that leaves hair soft without weighing it down.", price: 21, compareAtPrice: 28, category: "beauty", tags: ["haircare", "hydration", "botanical"], badge: null, image: "beauty" },
  { name: "Tinted Lip Balm", slug: "tinted-lip-balm", description: "A nourishing tinted lip balm that adds a soft wash of colour and comfortable shine.", price: 14, compareAtPrice: 18, category: "beauty", tags: ["makeup", "daily", "giftable"], badge: "New", image: "beauty" },
  { name: "Coconut Body Lotion", slug: "coconut-body-lotion", description: "A fast-absorbing body lotion with coconut and oat to keep skin comfortable all day.", price: 19, compareAtPrice: 25, category: "beauty", tags: ["bodycare", "hydration", "daily"], badge: null, image: "beauty" },
  { name: "Nourishing Hair Serum", slug: "nourishing-hair-serum", description: "A lightweight finishing serum that adds shine and smooths dry ends.", price: 24, compareAtPrice: 31, category: "beauty", tags: ["haircare", "shine", "travel"], badge: null, image: "beauty" },
  { name: "Table Lamp", slug: "table-lamp", description: "A warm, dimmable table lamp with a weighted base and soft architectural silhouette.", price: 68, compareAtPrice: 88, category: "home", tags: ["workspace", "light", "home"], badge: "Editor pick", image: "home" },
  { name: "Study Chair", slug: "study-chair", description: "A supportive study chair with breathable upholstery and a calm, compact footprint.", price: 165, compareAtPrice: 210, category: "home", tags: ["workspace", "comfort", "home"], badge: null, image: "home" },
  { name: "Insulated Water Bottle", slug: "insulated-water-bottle", description: "A double-wall insulated bottle that keeps drinks cold through commutes and long study sessions.", price: 28, compareAtPrice: 36, category: "home", tags: ["utility", "travel", "everyday"], badge: "Popular", image: "home" },
  { name: "Washed Cotton Bedsheet", slug: "washed-cotton-bedsheet", description: "A breathable washed-cotton bedsheet with a soft lived-in texture.", price: 74, compareAtPrice: 96, category: "home", tags: ["bedroom", "cotton", "comfort"], badge: null, image: "home" },
  { name: "Cushion Set", slug: "cushion-set", description: "A set of two textured cushions that add a quiet layer of colour to the sofa.", price: 36, compareAtPrice: 48, category: "home", tags: ["decor", "comfort", "giftable"], badge: null, image: "home" },
  { name: "Minimal Wall Clock", slug: "minimal-wall-clock", description: "A silent wall clock with a clean face and a slim natural-wood frame.", price: 44, compareAtPrice: 58, category: "home", tags: ["decor", "workspace", "quiet"], badge: null, image: "home" },
  { name: "Desk Organizer", slug: "desk-organizer", description: "A modular desk organizer for pens, cables, notes, and the small things that drift.", price: 29, compareAtPrice: 38, category: "home", tags: ["workspace", "utility", "desk"], badge: "New", image: "home" },
  { name: "Stackable Storage Box", slug: "stackable-storage-box", description: "A sturdy stackable storage box with a simple lid for calmer shelves and cupboards.", price: 32, compareAtPrice: 42, category: "home", tags: ["storage", "utility", "home"], badge: null, image: "home" },
];

export type ApiProduct = {
  id: number;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  category: string;
  categorySlug: string;
  imageUrl: string;
  rating: number;
  reviewCount: number;
  stock: number;
  tags: string[];
  badge: string | null;
};

function toProduct(row: {
  product: typeof productsTable.$inferSelect;
  category: typeof categoriesTable.$inferSelect;
}): ApiProduct {
  const { product, category } = row;
  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: Number(product.price),
    compareAtPrice:
      product.compareAtPrice == null ? null : Number(product.compareAtPrice),
    category: category.name,
    categorySlug: category.slug,
    imageUrl: product.imageUrl,
    rating: Number(product.rating),
    reviewCount: product.reviewCount,
    stock: product.stock,
    tags: product.tags ?? [],
    badge: product.badge,
  };
}

export async function listApiProducts(input: {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "featured" | "price-low" | "price-high" | "rating" | "popular" | "newest";
  limit?: number;
}): Promise<ApiProduct[]> {
  const filters = [];
  if (input.search) {
    const term = `%${input.search}%`;
    filters.push(or(
      ilike(productsTable.name, term),
      ilike(productsTable.description, term),
      sql`array_to_string(${productsTable.tags}, ' ') ILIKE ${term}`,
      ilike(categoriesTable.name, term),
      ilike(categoriesTable.slug, term),
    ));
  }
  if (input.category) {
    filters.push(eq(categoriesTable.slug, input.category));
  }
  if (input.minPrice !== undefined) {
    filters.push(gte(productsTable.price, input.minPrice));
  }
  if (input.maxPrice !== undefined) {
    filters.push(lte(productsTable.price, input.maxPrice));
  }

  const rows = await db
    .select({ product: productsTable, category: categoriesTable })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(
      input.sort === "price-low"
        ? asc(productsTable.price)
        : input.sort === "price-high"
          ? desc(productsTable.price)
          : input.sort === "rating" || input.sort === "popular"
            ? desc(productsTable.rating)
            : desc(productsTable.createdAt),
    )
    .limit(input.limit ?? 24);

  return rows.map(toProduct);
}

export async function getApiProduct(id: number): Promise<ApiProduct | null> {
  const [row] = await db
    .select({ product: productsTable, category: categoriesTable })
    .from(productsTable)
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(eq(productsTable.id, id));
  return row ? toProduct(row) : null;
}

export async function seedCommerceData(): Promise<void> {
  const requiredCategories = [
    { name: "Electronics", slug: "electronics" },
    { name: "Fashion", slug: "fashion" },
    { name: "Books", slug: "books" },
    { name: "Beauty", slug: "beauty" },
    { name: "Home & Living", slug: "home-living" },
  ];
  let categories = await db.select().from(categoriesTable).orderBy(asc(categoriesTable.id));
  const existingCategorySlugs = new Set(categories.map((category) => category.slug));
  const missingCategories = requiredCategories.filter((category) => !existingCategorySlugs.has(category.slug));
  if (missingCategories.length) {
    const addedCategories = await db.insert(categoriesTable).values(missingCategories).returning();
    categories = [...categories, ...addedCategories];
  }
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category.id]));
  const categoryId = (slug: string) => {
    const value = categoryBySlug.get(slug);
    if (!value) throw new Error(`Missing seed category ${slug}`);
    return value;
  };
  const existingSlugs = new Set((await db.select({ slug: productsTable.slug }).from(productsTable)).map((row) => row.slug));
  const missingProducts = seedProducts.map(
    (product, index) => ({
      name: product.name,
      slug: product.slug,
      description: product.description,
      price: product.price,
      compareAtPrice: product.compareAtPrice,
      categoryId: categoryId(product.category === "home" ? "home-living" : product.category),
      imageUrl: productImages[product.image],
      rating: 4.2 + (index % 8) / 10,
      reviewCount: 12 + index * 3,
      stock: index === 5 ? 4 : 18 + index,
      tags: product.tags,
      badge: product.badge,
    }),
  ).filter((product) => !existingSlugs.has(product.slug));
  const products = missingProducts.length
    ? await db.insert(productsTable).values(missingProducts).returning()
    : [];

  let [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.email, "maya.chen@example.com"));
  const isNewCustomer = !customer;
  if (!customer) {
    [customer] = await db
      .insert(customersTable)
      .values({
        name: "Maya Chen",
        email: "maya.chen@example.com",
        gender: "Female",
        age: 24,
        city: "Bengaluru",
        segment: "High value",
      })
      .returning();
  }

  if (!isNewCustomer) {
    if (customer.gender == null || customer.age == null || customer.city == null) {
      [customer] = await db
        .update(customersTable)
        .set({
          gender: customer.gender ?? "Female",
          age: customer.age ?? 24,
          city: customer.city ?? "Bengaluru",
        })
        .where(eq(customersTable.id, customer.id))
        .returning();
    }
    logger.info({ productsAdded: products.length }, "Commerce catalog already existed");
  }
  const allProducts = await db.select().from(productsTable).orderBy(asc(productsTable.id));
  if (!allProducts.length) return;
  const firstProduct = allProducts[0];
  const secondProduct = allProducts[1] ?? firstProduct;
  const thirdProduct = allProducts[2] ?? secondProduct;
  const [existingWishlist] = await db.select({ id: wishlistTable.id }).from(wishlistTable).where(eq(wishlistTable.customerId, customer.id)).limit(1);
  if (!existingWishlist) {
    await db.insert(wishlistTable).values([
      { customerId: customer.id, productId: secondProduct.id },
      { customerId: customer.id, productId: thirdProduct.id },
    ]);
  }
  const [existingActivity] = await db.select({ id: customerActivityTable.id }).from(customerActivityTable).where(eq(customerActivityTable.customerId, customer.id)).limit(1);
  if (!existingActivity) {
    await db.insert(customerActivityTable).values([
      { customerId: customer.id, productId: firstProduct.id, type: "view" },
      { customerId: customer.id, productId: secondProduct.id, type: "like" },
      { customerId: customer.id, productId: thirdProduct.id, type: "purchase" },
    ]);
  }
  const [existingOrder] = await db.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.customerId, customer.id)).limit(1);
  if (!existingOrder) {
    const [order] = await db.insert(ordersTable).values({
      customerId: customer.id,
      status: "delivered",
      total: Number(thirdProduct.price),
      placedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
    }).returning();
    await db.insert(orderItemsTable).values({
      orderId: order.id,
      productId: thirdProduct.id,
      quantity: 1,
      unitPrice: Number(thirdProduct.price),
    });
    await db.insert(paymentsTable).values({ orderId: order.id, amount: Number(thirdProduct.price), status: "paid" });
  }
  const additionalCustomers = [
    { name: "Arjun Rao", email: "arjun.rao@example.com", gender: "Male", age: 29, city: "Mumbai", segment: "Returning" },
    { name: "Leila Morgan", email: "leila.morgan@example.com", gender: "Female", age: 31, city: "London", segment: "New" },
    { name: "Noah Williams", email: "noah.williams@example.com", gender: "Non-binary", age: 27, city: "Austin", segment: "High value" },
  ];
  const seededCustomers = [customer];
  for (const profile of additionalCustomers) {
    let [extraCustomer] = await db.select().from(customersTable).where(eq(customersTable.email, profile.email));
    if (!extraCustomer) {
      [extraCustomer] = await db.insert(customersTable).values(profile).returning();
    }
    seededCustomers.push(extraCustomer);
  }
  for (const [index, demoCustomer] of seededCustomers.entries()) {
    const [demoOrder] = await db.select({ id: ordersTable.id }).from(ordersTable).where(eq(ordersTable.customerId, demoCustomer.id)).limit(1);
    if (!demoOrder) {
      const purchasedProduct = allProducts[(index + 3) % allProducts.length];
      const total = Number(purchasedProduct.price) * (index + 1);
      const [createdOrder] = await db.insert(ordersTable).values({
        customerId: demoCustomer.id,
        status: index % 2 === 0 ? "delivered" : "processing",
        total,
        placedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * (35 + index * 42)),
      }).returning();
      await db.insert(orderItemsTable).values({
        orderId: createdOrder.id,
        productId: purchasedProduct.id,
        quantity: index + 1,
        unitPrice: Number(purchasedProduct.price),
      });
      await db.insert(paymentsTable).values({ orderId: createdOrder.id, amount: total, status: "paid" });
      await db.insert(customerActivityTable).values({
        customerId: demoCustomer.id,
        productId: purchasedProduct.id,
        type: "purchase",
        occurredAt: createdOrder.placedAt,
      });
    }
  }
  const reviewCustomers = seededCustomers.slice(0, 3);
  for (const [index, reviewer] of reviewCustomers.entries()) {
    const reviewedProduct = allProducts[index];
    await db.insert(reviewsTable).values({
      customerId: reviewer.id,
      productId: reviewedProduct.id,
      rating: 4 + (index % 2),
      body: ["Thoughtful design and genuinely useful every day.", "The quality is better than expected and the details feel considered.", "A reliable pick that has earned a regular place in my routine."][index],
    }).onConflictDoNothing();
  }
  logger.info({ products: products.length, customerId: customer.id, totalProducts: allProducts.length }, "Seeded commerce demo data");
}

export async function getRecommendations(
  productId: number,
  customerId = 1,
): Promise<Array<ApiProduct & { score: number; reason: string }>> {
  const current = await getApiProduct(productId);
  if (!current) return [];

  const activity = await db
    .select({ productId: customerActivityTable.productId, type: customerActivityTable.type })
    .from(customerActivityTable)
    .where(eq(customerActivityTable.customerId, customerId));
  const interactedIds = activity.map((item) => item.productId);
  const interactedProducts = interactedIds.length
    ? await db
        .select({ product: productsTable, category: categoriesTable })
        .from(productsTable)
        .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
        .where(inArray(productsTable.id, interactedIds))
    : [];
  const likedTags = new Set(
    interactedProducts.flatMap(({ product }) => product.tags ?? []),
  );

  const candidates = await listApiProducts({ limit: 50, sort: "featured" });
  const ranked = candidates
    .filter((candidate) => candidate.id !== productId)
    .map((candidate) => {
      const sharedTags = candidate.tags.filter((tag) => likedTags.has(tag)).length;
      const sameCategory = candidate.categorySlug === current.categorySlug;
      const score = Math.min(
        1,
        0.55 + (sameCategory ? 0.2 : 0) + sharedTags * 0.06 + (candidate.rating - 4.2) * 0.04,
      );
      const reason = sameCategory
        ? `Because you explored ${current.category}`
        : sharedTags
          ? "Matches your recent interests"
          : "Popular with similar shoppers";
      return { ...candidate, score: Number(score.toFixed(1)), reason };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  await db.transaction(async (tx) => {
    for (const item of ranked) {
      await tx.insert(recommendationsTable).values({
        customerId,
        productId: item.id,
        score: item.score,
        reason: item.reason,
      }).onConflictDoUpdate({
        target: [recommendationsTable.customerId, recommendationsTable.productId],
        set: { score: item.score, reason: item.reason, generatedAt: new Date() },
      });
    }
  });
  return ranked;
}

export async function getCustomerSummary(customerId: number) {
  const [customer] = await db
    .select()
    .from(customersTable)
    .where(eq(customersTable.id, customerId));
  if (!customer) return null;
  const [spent] = await db
    .select({
      value: sql<number>`coalesce(sum(${ordersTable.total}), 0)`,
      count: sql<number>`count(${ordersTable.id})`,
    })
    .from(ordersTable)
    .where(eq(ordersTable.customerId, customerId));
  const [wishlist] = await db
    .select({ count: sql<number>`count(${wishlistTable.id})` })
    .from(wishlistTable)
    .where(and(eq(wishlistTable.customerId, customerId), eq(wishlistTable.active, true)));
  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    gender: customer.gender,
    age: customer.age,
    city: customer.city,
    segment: customer.segment,
    totalSpent: Number(spent?.value ?? 0),
    orderCount: Number(spent?.count ?? 0),
    wishlistCount: Number(wishlist?.count ?? 0),
    joinedAt: customer.joinedAt,
  };
}