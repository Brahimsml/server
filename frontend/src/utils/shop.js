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

// Shape the cart expects (full image URL, "$" price string)
export const toCartProduct = (product) => ({
  ...product,
  image: imageUrl(product.image),
  price: `$${Number(product.price || 0).toFixed(2)}`,
});

// Order status -> badge style + customer-friendly label
// How the customer pays (matches the backend)
export const PAYMENT_METHODS = {
  cash: { label: "Cash on delivery", hint: "Pay the driver in cash when your order arrives." },
  card: { label: "Visa card", hint: "Pay with your Visa card when your order arrives." },
};

export const paymentLabel = (method) => PAYMENT_METHODS[method]?.label || "";

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
  e.currentTarget.src = FALLBACK_IMG;
};
