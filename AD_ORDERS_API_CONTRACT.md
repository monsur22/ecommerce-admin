# Orders from social ads — API contract (backend: inventory-laravel)

Status: IMPLEMENTED + tested (backend, 2026-11-02). Keep this file as the source of truth; if anything here changes it is updated in place.

All admin routes: prefix `/api`, JWT auth, envelope `{ success, message, data, meta? }`, errors `{ success:false, message, errors? }`
(422 `errors` = `{ field: [msg] }`, `message` = first readable error). Public storefront routes: prefix `/api/store`,
company resolved by subdomain (`resolve_company`) or `?company_id=`; envelope `{ success, data, message? }`.
All JSON keys camelCase unless stated.

---------------------------------------------------------------------------------------------------
## 1. Enums

| name | values |
|---|---|
| `adSource` (orders) | `facebook` `instagram` `whatsapp` `messenger` `tiktok` `google` `youtube` `phone` `other` (null = direct / walk-in / unknown) |
| `channel` (campaign links) | `facebook` `instagram` `whatsapp` `messenger` `tiktok` `google` `youtube` `other` |
| `targetType` (campaign links) | `product` `collection` `store` `quick_order` |
| `source` (orders, unchanged) | `pos` `manual` `storefront` |

Labels (use in UI): facebook=Facebook, instagram=Instagram, whatsapp=WhatsApp, messenger=Messenger, tiktok=TikTok,
google=Google, youtube=YouTube, phone=Phone call, other=Other.
"From ads/social" = any non-null adSource except `phone` (filter value `any`).

New-sale "Source" select → send `adSource`: Walk-in/Direct → `null` (or `"direct"`, stored as null), Facebook → `facebook`,
Instagram → `instagram`, WhatsApp → `whatsapp`, Messenger → `messenger`, TikTok → `tiktok`, Phone call → `phone`, Other → `other`.

---------------------------------------------------------------------------------------------------
## 2. Orders (sells) — attribution fields

### 2.1 Sell DTO (every `/api/sells*` response that returns a sell) — NEW fields
```json
{
  "adSource": "facebook",            // enum above or null
  "adSourceLabel": "Facebook",       // null when adSource null
  "utmSource": "facebook", "utmMedium": "social", "utmCampaign": "eid-panjabi", "utmContent": "panjabi-blue", "utmTerm": null,
  "clickId": "IwAR3...",             // fbclid / gclid / ttclid value, or null
  "campaignLinkId": 12,
  "campaignLink": { "id": 12, "name": "Eid Panjabi FB post", "code": "k7m2qx", "channel": "facebook" },   // or null
  "landingUrl": "/product/blue-panjabi?utm_source=facebook&cl=k7m2qx",
  "referrer": "https://l.facebook.com/",
  "isQuickOrder": true,
  "possibleDuplicate": false
}
```
`source` stays the creation channel (`storefront` for quick orders and checkout, `manual` for New sale, `pos`).

### 2.2 `GET /api/sells` — new query params (combine with all existing ones)
| param | values |
|---|---|
| `adSource` | one enum value, `any` (= any social/ad source, i.e. not null and not `phone`), `none` (= null) |
| `campaignLinkId` | int — orders attributed to one link (link detail drawer) |
| `quickOrder` | `1` → only quick orders |
| `possibleDuplicate` | `1` → only flagged orders |

New meta key (respects every filter EXCEPT `adSource`):
```json
"meta": { "...existing pagination/summary/tabCounts/kpis...": "",
  "adSourceCounts": { "any": 14, "none": 120, "facebook": 9, "instagram": 2, "whatsapp": 3, "messenger": 0, "tiktok": 0, "google": 0, "youtube": 0, "phone": 1, "other": 0 } }
```
`meta.tabCounts` respects `adSource` (like other filters).

### 2.3 `POST /api/sells` (New sale / manual order) and `PUT /api/sells/{id}`
Optional body field `adSource` (enum above, or `"direct"`/`"walk-in"`/`""`/null → stored null). Bad value → 422
`{ message: "Validation failed.", errors: { adSource: ["Source must be one of: direct, facebook, instagram, whatsapp, messenger, tiktok, google, youtube, phone, other"] } }`.
Response sell carries `adSource` / `adSourceLabel`.

### 2.4 Notification
New-order notification title becomes `New order from Facebook` (label of adSource) when the order has an adSource,
otherwise unchanged `New Order Received`. Message: `Order ORD-X placed by Rahim for ৳1,250.00` + ` · Quick order` when quick
+ ` · Campaign: <link name>` when attributed to a link. Notification `data` gains `adSource`, `isQuickOrder`, `campaignLinkId`.

### 2.5 Dashboard `GET /api/dashboard/channels` (existing widget payload) — additive
`data.adSources: [{ "key": "facebook", "orders": 9, "revenue": 12500.0 }]` (only non-null adSource, same period/location filters,
sorted by revenue desc). Existing `channels` / `paymentMethods` unchanged.

---------------------------------------------------------------------------------------------------
## 3. Campaign / ad order links (admin) — permission module **"Marketing"**

Permission checks: `Marketing.read` (GET), `Marketing.write` (POST/PUT/PATCH), `Marketing.delete` (DELETE).
"Marketing" is a new plan module (added to every plan) and a new role-matrix group `Marketing` → module `Ad order links`
(permissions `["Marketing"]`). Existing roles received the same rights they have on `Orders`.

### 3.1 Link object (`CampaignLinkDTO`)
```json
{
  "id": 12,
  "name": "Eid Panjabi FB post",
  "channel": "facebook",
  "targetType": "quick_order",          // product | collection | store | quick_order
  "targetId": 345,                        // product id (product/quick_order), collection id (collection), null (store)
  "target": { "id": 345, "name": "Blue Panjabi", "slug": "blue-panjabi", "image": "https://.../a.jpg" },  // null for store / missing target
  "code": "k7m2qx",
  "utmSource": "facebook", "utmMedium": "social", "utmCampaign": "eid-panjabi-fb-post", "utmContent": "blue-panjabi",
  "notes": null,
  "isActive": true,
  "createdBy": 7, "createdByName": "Monsur",
  "storeBaseUrl": "http://demo.localhost:8081",       // null when the store URL cannot be resolved
  "targetPath": "/order/blue-panjabi?utm_source=facebook&utm_medium=social&utm_campaign=eid-panjabi-fb-post&utm_content=blue-panjabi&cl=k7m2qx",
  "fullUrl": "http://demo.localhost:8081/order/blue-panjabi?utm_source=facebook&utm_medium=social&utm_campaign=eid-panjabi-fb-post&utm_content=blue-panjabi&cl=k7m2qx",
  "shortUrl": "http://demo.localhost:8081/l/k7m2qx",
  "stats": { "clicks": 120, "orders": 9, "revenue": 12500.0, "conversionRate": 7.5 },   // for the list's `period` (lifetime on show/create/update)
  "lastClickedAt": "2026-11-01T10:22:00Z",
  "createdAt": "2026-11-01T09:00:00Z", "updatedAt": "2026-11-01T09:00:00Z"
}
```
URL building:
* `storeBaseUrl`: online-store setting `business.onlineStore.slug` when it contains a dot (custom domain → `https://<slug>`, same rule as
  admin "View store"); otherwise the company subdomain through env `STOREFRONT_URL_PATTERN` (default `http://{subdomain}.localhost:8081`);
  null if neither exists (then `fullUrl`/`shortUrl` are null and only `targetPath` is set).
* Target paths: product → `/product/<slug|id>`, collection → `/collections/<slug|id>`, store → `/`, quick_order → `/order/<product slug|id>`.
* Query: `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` (only non-empty ones) then `cl=<code>`.
* `shortUrl` = `<storeBaseUrl>/l/<code>` (storefront route that calls `GET /api/store/l/{code}` then navigates to `targetUrl`).
* UTM defaults when not sent: `utmSource` = channel; `utmMedium` = `social` (facebook/instagram/tiktok/youtube/messenger), `chat` (whatsapp),
  `cpc` (google), `referral` (other); `utmCampaign` = slug(name) (max 100); `utmContent` = target slug (or `store`).
* `code`: 6 chars `[a-z2-9]` auto, unique per company; custom code allowed (4–20 chars `[A-Za-z0-9_-]`, stored lowercase).

### 3.2 Routes
| method | path | notes |
|---|---|---|
| GET | `/api/campaign-links` | `?search=&channel=&targetType=&isActive=true|false&period=&page=&perPage=` (perPage default 20, max 100). `stats` per link for `period` (default `all`). Response `data: [link]`, `meta.pagination {page, perPage, total, lastPage}` |
| GET | `/api/campaign-links/summary` | `?period=` (default `30d`) — see 3.4 |
| POST | `/api/campaign-links` | create (body 3.3) → 201 link |
| GET | `/api/campaign-links/{id}` | link (lifetime stats) |
| PUT | `/api/campaign-links/{id}` | partial update (any body field) → link |
| PATCH | `/api/campaign-links/{id}/status` | `{ "isActive": bool }` → link |
| DELETE | `/api/campaign-links/{id}` | soft delete; orders keep their attribution → `data: null` |
| GET | `/api/campaign-links/{id}/stats` | `?period=` (default `30d`) — see 3.5 |

`period`: `today` | `7d` | `30d` | `90d` | `all`, or `from=YYYY-MM-DD&to=YYYY-MM-DD` (overrides period). Bad value → 422 `Period must be one of: today, 7d, 30d, 90d, all`.

### 3.3 Create/update body
```json
{ "name": "Eid Panjabi FB post", "channel": "facebook", "targetType": "product", "targetId": 345,
  "code": null, "utmSource": null, "utmMedium": null, "utmCampaign": null, "utmContent": null, "notes": null, "isActive": true }
```
422 messages: `Give the link a name.` · `Choose a channel.` / `Channel must be one of: facebook, instagram, whatsapp, messenger, tiktok, google, youtube, other` ·
`Choose what the link opens.` / `Target must be one of: product, collection, store, quick_order` · `Choose a product.` (product/quick_order without targetId) ·
`Choose a collection.` · `That product was not found.` · `That collection was not found.` · `The code may only contain letters, numbers, - and _ (4-20 characters).` ·
`That code is already used by another link.` · `UTM values may not be longer than 100 characters.`
404 `Campaign link not found`.

### 3.4 Summary `GET /api/campaign-links/summary?period=30d`
```json
{ "period": { "key": "30d", "from": "2026-10-04", "to": "2026-11-02" },
  "totals": { "clicks": 340, "orders": 21, "revenue": 31200.0, "conversionRate": 6.18, "links": 8, "activeLinks": 6 },
  "byChannel": [ { "channel": "facebook", "label": "Facebook", "clicks": 250, "orders": 15, "revenue": 22000.0, "conversionRate": 6.0 } ],
  "topLinks": [ { "id": 12, "name": "...", "code": "k7m2qx", "channel": "facebook", "clicks": 120, "orders": 9, "revenue": 12500.0, "conversionRate": 7.5 } ] }
```
* clicks = recorded link clicks in period (deduped); orders/revenue by channel = ALL orders whose `adSource` is that channel
  (link-attributed or utm/referrer-derived), excluding `phone`. Revenue excludes Cancelled orders; orders count includes them.
* `byChannel` lists every channel that has clicks or orders (sorted by revenue, then orders). `topLinks` = top 5 by orders then revenue.
* conversionRate = orders / clicks × 100 (2 decimals; 0 when clicks = 0).

### 3.5 Link stats `GET /api/campaign-links/{id}/stats?period=30d`
```json
{ "link": { ...link object... },
  "period": { "key": "30d", "from": "2026-10-04", "to": "2026-11-02" },
  "clicks": 120, "orders": 9, "revenue": 12500.0, "confirmed": 5, "delivered": 3, "cancelled": 1, "pending": 3, "conversionRate": 7.5,
  "byDay": [ { "date": "2026-10-04", "clicks": 4, "orders": 1, "revenue": 1450.0 } ],      // every day in range (for `all`: since link creation)
  "recentOrders": [ { "id": 991, "invoiceNo": "ORD-...", "customerName": "Rahim", "amount": 1450.0, "status": "Pending", "orderTime": "...", "isQuickOrder": true, "possibleDuplicate": false } ] }
```
confirmed = status Processing (any fulfilment) or Delivered; delivered = status Delivered; cancelled = status Cancelled; pending = status Pending.
Full order list: `GET /api/sells?campaignLinkId=12`.

---------------------------------------------------------------------------------------------------
## 4. Public storefront API (`/api/store`, no auth)

### 4.1 `GET /api/store/l/{code}` — resolve short link + record click
Query (optional): `ref` = `document.referrer` of the landing page (else the `Referer` header is used if it is another site).
Throttle 60/min per IP (429 `Too Many Attempts.`). Click is recorded unless the same IP hash clicked the same link in the last 30 minutes, or the
User-Agent looks like a bot/preview fetcher. Only hashes (HMAC-SHA256) of IP and UA are stored.
```json
{ "success": true, "data": { "linkId": 12, "code": "k7m2qx", "targetType": "quick_order",
  "targetUrl": "/order/blue-panjabi?utm_source=facebook&utm_medium=social&utm_campaign=eid-panjabi-fb-post&utm_content=blue-panjabi&cl=k7m2qx",
  "counted": true } }
```
404 `{ success:false, message: "Link not found" }` for unknown/inactive/deleted links (storefront should fall back to `/`).

### 4.2 `GET /api/store/quick-order/{productSlugOrId}`
Product must be published + visible online. 404 `Product not found`.
```json
{ "success": true, "data": {
  "product": { "id": 345, "slug": "blue-panjabi", "name": "Blue Panjabi", "shortDescription": "plain text ≤ 300 chars",
    "image": "https://...", "images": ["https://..."],
    "price": 1800.0, "currentPrice": 1450.0, "offerPrice": 1450.0, "offerActive": true, "offerEndsAt": "2026-11-10",
    "stock": 23, "inStock": true, "hasVariants": true,
    "variants": [ { "id": 77, "name": "M / Blue", "attributes": {"Size":"M"}, "sku": "BP-M", "price": 1800.0, "currentPrice": 1450.0, "stock": 5, "inStock": true } ] },
  "deliveryOptions": [ { "id": 3, "name": "Inside Dhaka", "description": null, "price": 60.0, "estimatedDays": "1-2 days" } ],
  "paymentMethods": [
    { "slug": "cod", "name": "Cash on delivery", "type": "cod", "account": null, "accountName": null, "bankName": null, "requiresTransactionId": false },
    { "slug": "bkash", "name": "bKash", "type": "manual", "account": "017XXXXXXXX", "accountName": "Shop", "bankName": null, "requiresTransactionId": true } ],
  "defaultPaymentMethod": "cod",
  "cod": { "enabled": true, "limit": 5000.0, "fee": 0.0 },
  "store": { "name": "Demo Shop", "phone": "+8801...", "whatsapp": "8801...", "logoUrl": null, "currency": "BDT" } } }
```
* `image` / `images` (and link `target.image`) are stored paths exactly like `/api/store/products` returns them (e.g. `products/abc.webp`); resolve them the same way the product page does.
* `currentPrice` = server price for quantity 1 (PriceService: offer applied). Wholesale tiers may lower the per-unit price at checkout.
* `stock` = available at the storefront's ships-online locations (same as product page); with variants it is the sum of variant stock.
* `variants` excludes a lone `Default` variant (such products have `hasVariants: false`; order them without `variantId`).
  `attributes` is an object (or null). When `hasVariants` is true the POST requires `variantId`.
* Throttle 120/min per IP (429 `Too Many Attempts.`).
* `paymentMethods`: methods enabled for the online channel in Settings → Payments (`payments.methods`); when no methods are
  configured, falls back to active legacy payment methods (gateway ones have `type` = gateway name, e.g. `sslcommerz`, and the
  POST returns `paymentUrl`). `requiresTransactionId` true for `bkash`, `nagad`.
* `cod.enabled` = COD is among `paymentMethods`. COD is rejected when (subtotal − discount) ≥ `cod.limit` (limit 0 = no limit).
* `store.whatsapp` = `onlineStore.whatsappNumber` or `onlineStore.social.whatsapp` (may be null).

### 4.3 `POST /api/store/quick-order`
Body (camelCase):
```json
{ "productId": 345, "variantId": 77, "quantity": 1,
  "name": "Rahim Uddin", "phone": "01712345678", "address": "House 5, Road 3, Mirpur 10", "district": "Dhaka", "area": "Mirpur",
  "shippingMethodId": 3, "paymentMethod": "cod", "transactionId": null, "note": "Call before delivery",
  "website": "",
  "attribution": { "utmSource": "facebook", "utmMedium": "social", "utmCampaign": "eid", "utmContent": null, "utmTerm": null,
                   "clickId": "IwAR...", "clickIdType": "fbclid", "campaignCode": "k7m2qx", "landingUrl": "/order/blue-panjabi?...", "referrer": "https://l.facebook.com/" } }
```
* `phone`: BD mobile; accepted forms `01XXXXXXXXX`, `+8801XXXXXXXXX`, `8801XXXXXXXXX` (spaces/dashes ignored); must be `01[3-9]` + 8 digits. Stored as `01XXXXXXXXX`.
* `website` = honeypot (hidden input; must be empty/absent). Checked after field validation.
* `paymentMethod` = slug from GET (`cod`, `bkash`, `nagad`, ...). `transactionId` required for bkash/nagad; stored on the order
  (`transactionId`), order stays unpaid (`paymentStatus: pending`) until the admin confirms.
* Price, delivery charge (from `shippingMethodId`, must be an active delivery method), COD limit/fee, stock (storefront locations)
  are all computed server-side by the SAME service as `POST /api/store/orders`.
* Customer find-or-create by normalized phone (name/address/district/area filled for new customers).
* Order: `status: Pending`, `source: storefront`, `isQuickOrder: true`, attribution filled, `possibleDuplicate: true` when the same
  phone ordered the same product within the last 30 minutes (order is still created).
* Throttles (per store): every POST from an IP counts (10 / hour, 429 with `Retry-After` seconds header); 5 successful orders / day per phone.
* `note` is stored as the order's `notes`; `district` → `shippingCity`, `area` → `shippingAddressLine2`, country `Bangladesh`.

201:
```json
{ "success": true, "message": "Order placed",
  "data": { "orderId": 991, "invoiceNo": "ORD-6724A1B2C3D4E", "subtotal": 1450.0, "discount": 0.0, "deliveryCharge": 60.0, "codFee": 0.0,
            "total": 1510.0, "paymentMethod": "cod", "paymentStatus": "pending", "status": "Pending",
            "trackingUrl": "/track-order?invoice=ORD-6724A1B2C3D4E", "paymentUrl": null } }
```
Errors:
| status | message (errors key) |
|---|---|
| 422 | `Choose a product.` (productId) · `Quantity must be between 1 and 50.` (quantity) · `Enter your name.` (name) |
| 422 | `Enter a valid Bangladeshi mobile number, e.g. 01712345678.` (phone) · `Enter your full delivery address.` (address) |
| 422 | `Choose a delivery option` (shippingMethodId) · `Choose a payment method.` (paymentMethod) |
| 422 | `Enter the transaction ID of your bKash payment.` (transactionId; Nagad likewise) |
| 422 | `Choose an option (size / colour) for this product.` (variantId) · `That option is not available for this product.` (variantId) |
| 422 | `This product is not available.` · `Only 2 Blue Panjabi in stock` · `This payment method is not available for online orders.` |
| 422 | `Cash on delivery is only available for orders under 5000. Please choose another payment method.` |
| 422 | `Your order could not be placed. Please try again.` (honeypot filled) |
| 429 | `Too many orders from this device. Please try again later.` (IP) · `Too many orders for this phone number today. Please call us to order.` (phone) |

### 4.4 `POST /api/store/orders` (normal checkout) — additive
Accepts optional `attribution` object (same keys as 4.3; snake_case keys like `utm_source`, `campaign_code` also accepted) and
optional `transaction_id`. Stored on the sell with the same derivation rules. Response unchanged.

### 4.5 `GET /api/store/settings/online-store` — additive fields in `data`
`facebookPixelId`, `tiktokPixelId`, `whatsappNumber` (strings, '' when unset) read from `business.onlineStore.*`.
Admin saves them through the existing `PUT/PATCH settings business` call as `onlineStore.facebookPixelId` (digits, 5–20),
`onlineStore.tiktokPixelId` (letters/digits, 5–40), `onlineStore.whatsappNumber` (phone, e.g. `8801712345678`).

---------------------------------------------------------------------------------------------------
## 5. Attribution derivation (server, first match wins)
1. `campaignCode` / `cl` matches a link of this store → `campaignLinkId` + adSource = link channel (utm fields default to the link's).
2. `utmSource` (case-insensitive): facebook/fb/meta/facebook.com → facebook · ig/instagram → instagram · wa/whatsapp → whatsapp ·
   messenger/m.me → messenger · tiktok/tt → tiktok · google/gads/adwords/google_ads → google · youtube/yt → youtube · any other value → other.
3. Click id: `clickIdType` (or which of `fbclid`/`gclid`/`ttclid` was sent, or found in `landingUrl`): fbclid → facebook, gclid/gbraid/wbraid → google, ttclid → tiktok.
4. Referrer host: facebook.com/fb.com/l.facebook.com/m.facebook.com → facebook · instagram.com → instagram · wa.me/whatsapp.com → whatsapp ·
   messenger.com/m.me → messenger · tiktok.com → tiktok · google.* → google · youtube.com/youtu.be → youtube. Other hosts → no adSource.
Missing utm_* fields are also read from `landingUrl`'s query string. Lengths are truncated (utm 100, clickId 255, URLs 500).
