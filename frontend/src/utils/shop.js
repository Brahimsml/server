import { API_URL } from "../api";

// Full URL for a product/place image stored as a filename (or already a URL)
export const imageUrl = (image) => {
  if (!image) return "";
  if (/^(https?:|data:|blob:)/.test(image)) return image;
  return `${API_URL}/images/${image}`;
};

// $1,599.00
export const formatMoney = (value) =>
  (Number(String(value ?? 0).replace(/[$,]/g, "")) || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });

// Labels are typed by hand in admin ("Best Seller", "Best", "New "), so normalise them
export const normalizeLabel = (label) => String(label || "").trim();

export const isBestSeller = (product) => /best/i.test(normalizeLabel(product.label));

// One setting for "low stock": the shop shows "Only N left", the admin flags the product.
// Change this number to change it everywhere.
export const LOW_STOCK = 2;

export const isLowStock = (stock) => Number(stock) > 0 && Number(stock) <= LOW_STOCK;

export const isSoldOut = (product) =>
  product.stock_quantity !== undefined &&
  product.stock_quantity !== null &&
  Number(product.stock_quantity) <= 0;

// Product page address with the name in it, like big shops: /product/12-nvidia-rtx-4090
export const slugify = (text) =>
  String(text || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

export const productPath = (product) => {
  const slug = slugify(product?.name);
  return `/product/${product?.id}${slug ? `-${slug}` : ""}`;
};

// "12-nvidia-rtx-4090" (or just "12") -> 12
export const productIdFromParam = (param) => {
  const id = parseInt(String(param || ""), 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

// Shape the cart expects (full image URL, "$" price string)
export const toCartProduct = (product) => ({
  ...product,
  image: imageUrl(product.image),
  price: `$${Number(product.price || 0).toFixed(2)}`,
});

// Order status -> badge style + customer-friendly label
// How the customer can pay at checkout (matches the backend).
// Online card payment will be added once a payment provider is connected.
export const PAYMENT_METHODS = {
  cash: { label: "Cash on delivery", hint: "Pay the driver in cash when your order arrives." },
};

// Labels for orders, including any older ones paid by card
const PAYMENT_LABELS = { cash: "Cash on delivery", card: "Visa card" };

export const paymentLabel = (method) => PAYMENT_LABELS[method] || "";

export const DEFAULT_DELIVERY_FEE = 5;

const ORDER_STATUSES = {
  pending: "Pending",
  processing: "Processing",
  done: "Completed",
  cancelled: "Cancelled",
};

export const orderStatus = (status) => {
  const key = String(status || "pending").trim().toLowerCase();
  return ORDER_STATUSES[key]
    ? { key, label: ORDER_STATUSES[key] }
    : { key: "neutral", label: key.charAt(0).toUpperCase() + key.slice(1) };
};

export const ORDER_STATUS_OPTIONS = Object.entries(ORDER_STATUSES).map(([value, label]) => ({
  value,
  label,
}));

// "Oct 17, 2026" and "3:21 PM"
export const formatOrderDate = (value) => {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) return { date: "—", time: "" };
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
};

// Neutral box shown when an image is missing or fails to load
export const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#ece8df"/><text x="50%" y="50%" fill="#9a907c" font-family="sans-serif" font-size="18" text-anchor="middle" dominant-baseline="middle">No image</text></svg>'
  );

export const onImageError = (e) => {
  e.currentTarget.onerror = null;
  e.currentTarget.removeAttribute("srcset"); // or the browser keeps trying the smaller copies
  e.currentTarget.src = FALLBACK_IMG;
};

/*
  Smaller copies of an uploaded picture (WebP, made by the server: /img/<width>/<file>).
  Put in an <img srcSet>, with `sizes` saying how wide it shows; the browser downloads the
  smallest one that still looks sharp, so phones get small files. Outside pictures: undefined.
*/
const IMG_WIDTHS = [160, 320, 480, 800, 1200, 1600, 2400];
export const imageSrcSet = (image, max = 1200) => {
  if (!image || /^(https?:|data:|blob:)/.test(image)) return undefined;
  const file = encodeURIComponent(String(image).split("/").pop());
  return IMG_WIDTHS.filter((w) => w <= max)
    .map((w) => `${API_URL}/img/${w}/${file} ${w}w`)
    .join(", ");
};

/*
  Phone numbers typed by customers -> international form for WhatsApp / calls.
  Lebanon (961) is assumed when no country code is given:
  "70 123 456" -> 96170123456, "03 123 456" -> 9613123456, "+961 71 234 567" -> 96171234567
*/
export const internationalPhone = (phone) => {
  let digits = String(phone || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1).replace(/\D/g, "") || null;
  digits = digits.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2) || null;
  if (digits.startsWith("961")) return digits;
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.length >= 7 && digits.length <= 8 ? `961${digits}` : digits.length > 8 ? digits : null;
};

export const whatsappLink = (phone, message = "") => {
  const number = internationalPhone(phone);
  if (!number) return null;
  return `https://wa.me/${number}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
};

export const telLink = (phone) => {
  const number = internationalPhone(phone);
  return number ? `tel:+${number}` : null;
};

// Categories in the order the admin set (Categories page arrows); ties: most products first
export const byCategoryOrder = (a, b) =>
  (a.order ?? Infinity) - (b.order ?? Infinity) || (b.count || 0) - (a.count || 0) || String(a.name).localeCompare(String(b.name));


/*
  Category groups (Admin → Categories), like big stores: a few main groups ("Gaming Gear") with
  their categories inside (Keyboards, Mice…). One level only. With no groups set, every
  category is a main entry and everything works as before.
*/
// Is this product in the chosen category (or in a category of the chosen group)?
export const inCategoryOf = (p, name) =>
  !name || name === "All" || (p.category_name || "Other") === name || p.category_parent === name;

// From the products: main entries in the admin's order (with counts), each group with its
// categories inside → [{ name, order, count, children: [{ name, order, count }] }]
export const categoryTree = (products) => {
  const mains = new Map();
  products.forEach((p) => {
    const own = p.category_name || "Other";
    const mainName = p.category_parent || own;
    if (!mains.has(mainName)) mains.set(mainName, { name: mainName, order: undefined, count: 0, kids: new Map() });
    const main = mains.get(mainName);
    main.count += 1;
    if (p.category_parent) {
      main.order = p.category_parent_order ?? main.order;
      if (!main.kids.has(own)) main.kids.set(own, { name: own, order: p.category_order, count: 0 });
      main.kids.get(own).count += 1;
    } else {
      main.order = p.category_order ?? main.order;
    }
  });
  return Array.from(mains.values())
    .map(({ kids, ...m }) => ({ ...m, children: Array.from(kids.values()).sort(byCategoryOrder) }))
    .sort(byCategoryOrder);
};

// From the category list (/categories, with parent_id): main entries in order, each with its
// categories inside → [{ ...category, children: [...] }]
export const groupCategories = (categories) => {
  const list = Array.isArray(categories) ? categories : [];
  return list
    .filter((c) => !c.parent_id || !list.some((x) => x.id === c.parent_id))
    .map((c) => ({ ...c, children: list.filter((x) => x.parent_id === c.id) }));
};

/*
  Sale (Admin → Products → "Old price"): { old, save, percent } while the product is on sale,
  else null. The server says if the sale is on today (on_sale), so it ends by itself.
*/
export const saleOf = (p) => {
  const old = Number(p?.old_price);
  const price = Number(p?.price);
  if (!Number(p?.on_sale) || !(old > price) || !(price > 0)) return null;
  return { old, save: old - price, percent: Math.round((1 - price / old) * 100) };
};
