import { and, asc, desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  ActivityEvent,
  CreateReviewBody,
  CreateReviewResponse,
  CreateOrderBody,
  CreateOrderResponse,
  GetAnalyticsDashboardResponse,
  GetCustomerProfileParams,
  GetCustomerProfileResponse,
  GetProductParams,
  GetProductRecommendationsParams,
  GetProductRecommendationsResponse,
  GetProductResponse,
  ListProductReviewsParams,
  ListProductReviewsResponse,
  GetRecentActivityQueryParams,
  GetRecentActivityResponse,
  GetWishlistParams,
  GetWishlistResponse,
  ListCategoriesResponse,
  ListOrdersQueryParams,
  ListOrdersResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  ToggleWishlistBody,
  ToggleWishlistResponse,
  TrackActivityBody,
  TrackActivityResponse,
  UpdateCustomerProfileBody,
  UpdateCustomerProfileParams,
  UpdateCustomerProfileResponse,
} from "@workspace/api-zod";
import {
  categoriesTable,
  customerActivityTable,
  customersTable,
  db,
  orderItemsTable,
  ordersTable,
  paymentsTable,
  productsTable,
  reviewsTable,
  wishlistTable,
} from "@workspace/db";
import { and as drizzleAnd, eq as drizzleEq, inArray } from "drizzle-orm";
import {
  getApiProduct,
  getCustomerSummary,
  getRecommendations,
  listApiProducts,
} from "../lib/commerce";
import { requireAdmin, requireCustomer, type AuthenticatedRequest } from "../lib/auth";

const router: IRouter = Router();

router.get("/customers/me", requireCustomer, async (req: AuthenticatedRequest, res): Promise<void> => {
  const customer = await getCustomerSummary(req.customer!.id);
  res.json(GetCustomerProfileResponse.parse(customer));
});

router.use("/customers/:id", requireCustomer);
router.use("/wishlist", requireCustomer);
router.use("/orders", requireCustomer);
router.use("/reviews", requireCustomer);
router.use("/activity", requireCustomer);
router.use("/products/:id/recommendations", requireCustomer);
router.use("/analytics", requireAdmin);

router.get("/categories", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      id: categoriesTable.id,
      name: categoriesTable.name,
      slug: categoriesTable.slug,
      productCount: sql<number>`count(${productsTable.id})`,
    })
    .from(categoriesTable)
    .leftJoin(productsTable, eq(productsTable.categoryId, categoriesTable.id))
    .groupBy(categoriesTable.id)
    .orderBy(categoriesTable.name);
  res.json(ListCategoriesResponse.parse(rows.map((row) => ({ ...row, productCount: Number(row.productCount) }))));
});

router.get("/products", async (req, res): Promise<void> => {
  const parsed = ListProductsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const products = await listApiProducts(parsed.data);
  res.json(ListProductsResponse.parse(products));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const parsed = GetProductParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const product = await getApiProduct(parsed.data.id);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }
  res.json(GetProductResponse.parse(product));
});

router.get("/products/:id/recommendations", async (req, res): Promise<void> => {
  const parsed = GetProductRecommendationsParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const customer = (req as AuthenticatedRequest).customer!;
  res.json(GetProductRecommendationsResponse.parse(await getRecommendations(parsed.data.id, customer.id)));
});

router.get("/customers/:id", async (req, res): Promise<void> => {
  const parsed = GetCustomerProfileParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const customer = await getCustomerSummary((req as AuthenticatedRequest).customer!.id);
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  res.json(GetCustomerProfileResponse.parse(customer));
});

router.patch("/customers/:id", async (req, res): Promise<void> => {
  const params = UpdateCustomerProfileParams.safeParse(req.params);
  const body = UpdateCustomerProfileBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const [updated] = await db
    .update(customersTable)
    .set({ ...body.data, email: (req as AuthenticatedRequest).customer!.email })
    .where(eq(customersTable.id, (req as AuthenticatedRequest).customer!.id))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const summary = await getCustomerSummary(updated.id);
  res.json(UpdateCustomerProfileResponse.parse(summary));
});

router.get("/products/:id/reviews", async (req, res): Promise<void> => {
  const parsed = ListProductReviewsParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db
    .select({
      id: reviewsTable.id,
      customerId: reviewsTable.customerId,
      customerName: customersTable.name,
      productId: reviewsTable.productId,
      rating: reviewsTable.rating,
      body: reviewsTable.body,
      createdAt: reviewsTable.createdAt,
    })
    .from(reviewsTable)
    .innerJoin(customersTable, eq(reviewsTable.customerId, customersTable.id))
    .where(eq(reviewsTable.productId, parsed.data.id))
    .orderBy(desc(reviewsTable.createdAt));
  res.json(ListProductReviewsResponse.parse(rows.map((row) => ({ ...row, body: row.body ?? "" }))));
});

router.get("/customers/:id/wishlist", async (req, res): Promise<void> => {
  const parsed = GetWishlistParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db
    .select({ product: productsTable, category: categoriesTable })
    .from(wishlistTable)
    .innerJoin(productsTable, eq(wishlistTable.productId, productsTable.id))
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .where(and(eq(wishlistTable.customerId, (req as AuthenticatedRequest).customer!.id), eq(wishlistTable.active, true)));
  const products = rows.map(({ product, category }) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    price: Number(product.price),
    compareAtPrice: product.compareAtPrice == null ? null : Number(product.compareAtPrice),
    category: category.name,
    categorySlug: category.slug,
    imageUrl: product.imageUrl,
    rating: Number(product.rating),
    reviewCount: product.reviewCount,
    stock: product.stock,
    tags: product.tags ?? [],
    badge: product.badge,
  }));
  res.json(GetWishlistResponse.parse(products));
});

router.post("/wishlist", async (req, res): Promise<void> => {
  const parsed = ToggleWishlistBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { productId } = parsed.data;
  const customerId = (req as AuthenticatedRequest).customer!.id;
  const [existing] = await db
    .select()
    .from(wishlistTable)
    .where(and(eq(wishlistTable.customerId, customerId), eq(wishlistTable.productId, productId)));
  let saved = true;
  if (existing) {
    saved = !existing.active;
    await db
      .update(wishlistTable)
      .set({ active: saved })
      .where(eq(wishlistTable.id, existing.id));
  } else {
    await db.insert(wishlistTable).values({ customerId, productId, active: true });
  }
  res.json(ToggleWishlistResponse.parse({ saved, productId }));
});

router.get("/orders", async (req, res): Promise<void> => {
  const parsed = ListOrdersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const orders = await db
    .select()
    .from(ordersTable)
    .where(eq(ordersTable.customerId, (req as AuthenticatedRequest).customer!.id))
    .orderBy(desc(ordersTable.placedAt));
  const result = await Promise.all(
    orders.map(async (order) => {
      const items = await db
        .select({
          productId: orderItemsTable.productId,
          productName: productsTable.name,
          quantity: orderItemsTable.quantity,
          unitPrice: orderItemsTable.unitPrice,
        })
        .from(orderItemsTable)
        .innerJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
        .where(eq(orderItemsTable.orderId, order.id));
      return {
        id: order.id,
        customerId: order.customerId,
        status: order.status,
        total: Number(order.total),
        paymentMethod: "demo",
        paymentStatus: "paid",
        placedAt: order.placedAt,
        items: items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.unitPrice) * item.quantity,
        })),
      };
    }),
  );
  res.json(ListOrdersResponse.parse(result));
});

router.post("/orders", async (req, res): Promise<void> => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { items, paymentMethod } = parsed.data;
  const customerId = (req as AuthenticatedRequest).customer!.id;
  const productIds = items.map((item) => item.productId);
  const products = await db.select().from(productsTable).where(inArray(productsTable.id, productIds));
  const productById = new Map(products.map((product) => [product.id, product]));
  const missing = items.find((item) => !productById.has(item.productId));
  if (missing) {
    res.status(400).json({ error: `Product ${missing.productId} not found` });
    return;
  }
  const unavailable = items.find((item) => item.quantity > productById.get(item.productId)!.stock);
  if (unavailable) {
    res.status(409).json({ error: `Only ${productById.get(unavailable.productId)!.stock} units remain` });
    return;
  }
  const total = items.reduce((sum, item) => sum + Number(productById.get(item.productId)!.price) * item.quantity, 0);
  const created = await db.transaction(async (tx) => {
    const [order] = await tx
      .insert(ordersTable)
      .values({ customerId, total, status: "processing" })
      .returning();
    await tx.insert(orderItemsTable).values(
      items.map((item) => ({
        orderId: order.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(productById.get(item.productId)!.price),
      })),
    );
    await tx.insert(paymentsTable).values({ orderId: order.id, amount: total, status: "paid" });
    for (const item of items) {
      await tx
        .update(productsTable)
        .set({ stock: sql`${productsTable.stock} - ${item.quantity}` })
        .where(eq(productsTable.id, item.productId));
    }
    await tx.insert(customerActivityTable).values(
      items.map((item) => ({ customerId, productId: item.productId, type: "purchase" })),
    );
    return order;
  });
  res.status(201).json(
    CreateOrderResponse.parse({
      id: created.id,
      customerId: created.customerId,
      status: created.status,
      total: Number(created.total),
      paymentMethod,
      paymentStatus: "paid",
      placedAt: created.placedAt,
      items: items.map((item) => {
        const product = productById.get(item.productId)!;
        const unitPrice = Number(product.price);
        return {
          productId: item.productId,
          productName: product.name,
          quantity: item.quantity,
          unitPrice,
          lineTotal: unitPrice * item.quantity,
        };
      }),
    }),
  );
});

router.post("/reviews", async (req, res): Promise<void> => {
  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { productId, rating, body } = parsed.data;
  const customerId = (req as AuthenticatedRequest).customer!.id;
  const [review] = await db
    .insert(reviewsTable)
    .values({ customerId, productId, rating, body })
    .onConflictDoUpdate({
      target: [reviewsTable.customerId, reviewsTable.productId],
      set: { rating, body, createdAt: new Date() },
    })
    .returning();
  await db
    .update(productsTable)
    .set({
      rating: sql`(select coalesce(avg(${reviewsTable.rating}), 0) from ${reviewsTable} where ${reviewsTable.productId} = ${productId})`,
      reviewCount: sql`(select count(*) from ${reviewsTable} where ${reviewsTable.productId} = ${productId})`,
    })
    .where(eq(productsTable.id, productId));
  const [row] = await db
    .select({
      id: reviewsTable.id,
      customerId: reviewsTable.customerId,
      customerName: customersTable.name,
      productId: reviewsTable.productId,
      rating: reviewsTable.rating,
      body: reviewsTable.body,
      createdAt: reviewsTable.createdAt,
    })
    .from(reviewsTable)
    .innerJoin(customersTable, eq(reviewsTable.customerId, customersTable.id))
    .where(eq(reviewsTable.id, review.id));
  res.status(201).json(CreateReviewResponse.parse({ ...row, body: row.body ?? "" }));
});

router.post("/activity", async (req, res): Promise<void> => {
  const parsed = TrackActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [activity] = await db
    .insert(customerActivityTable)
    .values({ ...parsed.data, customerId: (req as AuthenticatedRequest).customer!.id })
    .returning();
  const [row] = await db
    .select({
      id: customerActivityTable.id,
      customerId: customerActivityTable.customerId,
      customerName: customersTable.name,
      productId: customerActivityTable.productId,
      productName: productsTable.name,
      type: customerActivityTable.type,
      occurredAt: customerActivityTable.occurredAt,
    })
    .from(customerActivityTable)
    .innerJoin(customersTable, eq(customerActivityTable.customerId, customersTable.id))
    .innerJoin(productsTable, eq(customerActivityTable.productId, productsTable.id))
    .where(eq(customerActivityTable.id, activity.id));
  res.status(201).json(TrackActivityResponse.parse(row));
});

router.get("/analytics/dashboard", async (_req, res): Promise<void> => {
  const [customerCount] = await db.select({ count: sql<number>`count(*)` }).from(customersTable);
  const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(productsTable);
  const [orderStats] = await db
    .select({
      count: sql<number>`count(*)`,
      revenue: sql<number>`coalesce(sum(${ordersTable.total}), 0)`,
      average: sql<number>`coalesce(avg(${ordersTable.total}), 0)`,
    })
    .from(ordersTable);
  const topProducts = await db
    .select({
      label: productsTable.name,
      value: sql<number>`coalesce(sum(${orderItemsTable.quantity}), 0)`,
    })
    .from(orderItemsTable)
    .innerJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .groupBy(productsTable.id)
    .orderBy(desc(sql`sum(${orderItemsTable.quantity})`))
    .limit(5);
  const categoryRevenue = await db
    .select({
      label: categoriesTable.name,
      value: sql<number>`coalesce(sum(${orderItemsTable.quantity} * ${orderItemsTable.unitPrice}), 0)`,
    })
    .from(orderItemsTable)
    .innerJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .innerJoin(categoriesTable, eq(productsTable.categoryId, categoriesTable.id))
    .groupBy(categoriesTable.id)
    .orderBy(desc(sql`sum(${orderItemsTable.quantity} * ${orderItemsTable.unitPrice})`));
  const segments = await db
    .select({ label: customersTable.segment, value: sql<number>`count(*)` })
    .from(customersTable)
    .groupBy(customersTable.segment);
  const orderStatuses = await db
    .select({ label: ordersTable.status, value: sql<number>`count(*)` })
    .from(ordersTable)
    .groupBy(ordersTable.status);
  const monthlyRevenue = await db
    .select({
      label: sql<string>`to_char(${ordersTable.placedAt}, 'Mon')`,
      value: sql<number>`coalesce(sum(${ordersTable.total}), 0)`,
    })
    .from(ordersTable)
    .groupBy(sql`date_trunc('month', ${ordersTable.placedAt})`, sql`to_char(${ordersTable.placedAt}, 'Mon')`)
    .orderBy(asc(sql`date_trunc('month', ${ordersTable.placedAt})`));
  const metrics = [
    { label: "Total customers", value: Number(customerCount.count), change: 12.4 },
    { label: "Total products", value: Number(productCount.count), change: 8.2 },
    { label: "Total orders", value: Number(orderStats.count), change: 18.7 },
    { label: "Total revenue", value: Number(orderStats.revenue), change: 14.8 },
    { label: "Average order value", value: Number(orderStats.average), change: 6.3 },
  ];
  res.json(
    GetAnalyticsDashboardResponse.parse({
      metrics,
      topProducts: topProducts.map((point) => ({ label: point.label, value: Number(point.value) })),
      categoryRevenue: categoryRevenue.map((point) => ({ label: point.label, value: Number(point.value) })),
      monthlyRevenue: monthlyRevenue.map((point) => ({ label: point.label, value: Number(point.value) })),
      segments: segments.map((point) => ({ label: point.label, value: Number(point.value) })),
      orderStatuses: orderStatuses.map((point) => ({ label: point.label, value: Number(point.value) })),
    }),
  );
});

router.get("/analytics/activity", async (req, res): Promise<void> => {
  const parsed = GetRecentActivityQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const rows = await db
    .select({
      id: customerActivityTable.id,
      customerId: customerActivityTable.customerId,
      customerName: customersTable.name,
      productId: customerActivityTable.productId,
      productName: productsTable.name,
      type: customerActivityTable.type,
      occurredAt: customerActivityTable.occurredAt,
    })
    .from(customerActivityTable)
    .innerJoin(customersTable, eq(customerActivityTable.customerId, customersTable.id))
    .innerJoin(productsTable, eq(customerActivityTable.productId, productsTable.id))
    .orderBy(desc(customerActivityTable.occurredAt))
    .limit(parsed.data.limit);
  res.json(GetRecentActivityResponse.parse(rows));
});

export default router;