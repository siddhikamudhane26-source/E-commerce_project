---
name: Clerk customer bridge
description: The durable rule for connecting Clerk sessions to an existing customer database.
---

Resolve the authenticated Clerk user on the server, link it to the existing customer row when the verified email matches, and derive the customer ID for every customer-owned operation.

**Why:** A browser-supplied customer ID can expose another customer's profile, wishlist, orders, activity, or recommendations when multiple accounts use the same storefront.

**How to apply:** Keep the Clerk mapping nullable so existing customer data remains intact, create a customer row on first authenticated use when no email match exists, and ignore client ownership fields after authentication.