# Intelligent Commerce ER diagram

The application uses a normalized relational model. Category and customer
attributes are stored once, while repeating order and activity facts are kept
in child tables.

```mermaid
erDiagram
  CUSTOMERS ||--o{ ORDERS : places
  CUSTOMERS ||--o{ REVIEWS : writes
  CUSTOMERS ||--o{ CUSTOMER_ACTIVITY : creates
  CUSTOMERS ||--o{ RECOMMENDATIONS : receives
  CUSTOMERS ||--o{ WISHLIST : saves
  CATEGORIES ||--o{ PRODUCTS : contains
  PRODUCTS ||--o{ ORDER_ITEMS : appears_in
  PRODUCTS ||--o{ REVIEWS : receives
  PRODUCTS ||--o{ CUSTOMER_ACTIVITY : is_viewed
  PRODUCTS ||--o{ RECOMMENDATIONS : is_recommended
  PRODUCTS ||--o{ WISHLIST : is_saved
  ORDERS ||--|{ ORDER_ITEMS : contains
  ORDERS ||--|| PAYMENTS : has

  CUSTOMERS {
    int id PK
    varchar name
    varchar email UK
    varchar gender
    int age
    varchar city
    varchar segment
    timestamptz joined_at
  }
  CATEGORIES {
    int id PK
    varchar name
    varchar slug UK
  }
  PRODUCTS {
    int id PK
    int category_id FK
    varchar name
    varchar slug UK
    numeric price
    numeric compare_at_price
    int stock
    numeric rating
  }
  ORDERS {
    int id PK
    int customer_id FK
    varchar status
    numeric total
    timestamptz placed_at
  }
  ORDER_ITEMS {
    int id PK
    int order_id FK
    int product_id FK
    int quantity
    numeric unit_price
  }
  PAYMENTS {
    int id PK
    int order_id FK
    varchar provider
    varchar status
    numeric amount
  }
  REVIEWS {
    int id PK
    int customer_id FK
    int product_id FK
    int rating
    text body
  }
  CUSTOMER_ACTIVITY {
    int id PK
    int customer_id FK
    int product_id FK
    varchar type
    timestamptz occurred_at
  }
  RECOMMENDATIONS {
    int id PK
    int customer_id FK
    int product_id FK
    numeric score
    varchar reason
  }
  WISHLIST {
    int id PK
    int customer_id FK
    int product_id FK
    boolean active
  }
```

## Relationship notes

- `customers → orders`, `customers → reviews`, `customers → customer_activity`,
  `customers → recommendations`, and `customers → wishlist` are one-to-many.
- `categories → products` is one-to-many.
- `orders → order_items` is one-to-many; `products → order_items` is the
  corresponding product-side relationship.
- `orders → payments` is one-to-one because a payment has a unique order ID.
- Reviews, wishlist rows, and recommendation rows use customer/product
  uniqueness where a duplicate relationship would not be meaningful.