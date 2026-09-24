# Intelligent Commerce

Intelligent Commerce is a presentation-ready e-commerce and customer analytics system built for a college project. It combines a modern storefront with a small, explainable content-based recommendation engine and an admin analytics dashboard.

## What the system demonstrates

- Storefront home, product browsing, search, category filters, product detail, cart, checkout, wishlist, customer profile, and order history.
- Recommendations based on a shopper's viewed, liked, and purchased products. The API scores candidates using shared categories, shared tags, product rating, and recent activity, persists the ranked results, and returns five or more candidates when the catalog allows it.
- Customer activity tracking for views, likes, and purchases.
- Admin metrics for customers, products, orders, revenue, average order value, best-selling products, category revenue, monthly revenue, customer segments, and order status.
- A normalized PostgreSQL schema with foreign keys, unique constraints, and indexes.

## Run the project

```bash
pnpm install
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run dev
```

The web app runs through the configured web workflow. The API is available under `/api`.

## API surface

- `GET /api/categories`
- `GET /api/products?search=&category=&sort=&minPrice=&maxPrice=`
- `GET /api/products/:id`
- `GET /api/products/:id/recommendations`
- `GET /api/products/:id/reviews`
- `GET /api/customers/:id`
- `PATCH /api/customers/:id`
- `GET /api/customers/:id/wishlist`
- `POST /api/wishlist`
- `GET /api/orders?customerId=1`
- `POST /api/orders` with `cod`, `upi`, or `card` payment method
- `POST /api/reviews`
- `POST /api/activity`
- `GET /api/analytics/dashboard`
- `GET /api/analytics/activity`

The API repeatably seeds a realistic catalog with 40 rubric-aligned products across Electronics, Fashion, Books, Beauty, and Home & Living. Older demo products are retained when upgrading an existing database, so an upgraded database can contain more than 40 products. It also repairs the demo customer's wishlist, activity, and order fixtures when they are missing.

## Database and SQL rubric

The Drizzle source of truth lives in `lib/db/src/schema/commerce.ts`. It includes:

- `customers`, `categories`, `products`
- `orders`, `order_items`, `payments`
- `reviews`, `customer_activity`, `recommendations`, `wishlist`

The companion `docs/database.sql` contains readable SQL examples for table creation, sample inserts, joins, grouping, aggregates, subqueries, stored procedures, stock and order-total triggers, and analytics queries. `docs/ER-DIAGRAM.md` contains the Mermaid ER diagram and relationship notes. The model keeps category data separate from products, order headers separate from order items, and customer actions separate from orders, satisfying the intended 1NF, 2NF, and 3NF discussion points.

## Explaining the recommendation approach

For a requested product, the server:

1. Loads the current product's category and tags.
2. Loads the demo customer's activity history.
3. Finds category/tag signals from viewed, liked, and purchased products.
4. Scores other products, adding weight for the same category and shared interest tags.
5. Returns the highest-ranked products with a numeric score and a plain-language reason.

This is deliberately content-based and deterministic, which makes it straightforward to explain during a viva. The recommendation rows are upserted into `recommendations` whenever the recommendation endpoint is generated.

## College Project Rubric

| Rubric area | Where it is implemented |
| --- | --- |
| ER diagram & relational schema — 10 | `lib/db/src/schema/commerce.ts` and `docs/ER-DIAGRAM.md` |
| Normalization — 10 | Separate category, product, order header, order item, payment, customer activity, review, wishlist, and recommendation relations |
| SQL implementation — 20 | PostgreSQL/Drizzle schema plus the executable SQL reference in `docs/database.sql` |
| Advanced SQL / procedures / triggers — 15 | `GetCustomerOrders`, `recalculate_order_total`, stock reduction, customer segmentation, top-selling, monthly revenue, and aggregate queries in `docs/database.sql` |
| Data analytics — 10 | `/api/analytics/dashboard`, RFM-style customer segments, revenue/category/order-status queries, and the `/admin` dashboard |
| AI/ML component — 15 | Explainable content-based recommendation scoring using category, tags, rating, and customer activity; persisted results in `recommendations` |
| Dashboard & visualization — 5 | Responsive admin view with KPI cards, revenue bars, segment bars, top-product ranking, category revenue, order status, and recent activity |
| Documentation & presentation — 5 | This README, ER diagram, API list, SQL examples, seeded demo data, and visible recommendation reasons |

## Deployment checklist

1. Set `DATABASE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`,
   `VITE_CLERK_PUBLISHABLE_KEY`, and `SESSION_SECRET` in Replit Secrets.
2. Apply the schema with `pnpm --filter @workspace/db run push`.
3. Start the configured API and web workflows. The API binds to `PORT`, and
   the Vite workflow uses the configured `BASE_PATH`.
4. The API build is production-compatible with
   `pnpm --filter @workspace/api-server run build` followed by
   `pnpm --filter @workspace/api-server run start`. The web bundle is built
   with `pnpm --filter @workspace/intelligent-commerce run build`.
5. Test `/api/healthz`, catalog search, category filters, checkout stock
   validation, profile updates, reviews, recommendations, and the analytics
   dashboard before publishing.

## Presentation test script

- Search `book` and confirm multiple book results appear.
- Select each required category and confirm at least six products.
- Combine category, price range, search, and sorting.
- Open a detail page, change quantity, save the product, and add it to the cart.
- Submit a demo order with UPI, card, or cash on delivery and confirm the
  order appears in account history and stock decreases.
- Submit a 1–5 review and confirm the average rating and review list update.
- Open `/admin` and explain KPI, revenue, category, top-product, segment,
  order-status, and activity sections using the SQL reference.