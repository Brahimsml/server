import {
  formatMoney,
  imageUrl,
  isBestSeller,
  isLowStock,
  isSoldOut,
  LOW_STOCK,
  normalizeLabel,
  orderStatus,
  toCartProduct,
  formatOrderDate,
  slugify,
  productPath,
  productIdFromParam,
} from "./shop";
import { API_URL } from "../api";

describe("formatMoney", () => {
  test("adds the dollar sign, thousands separator and cents", () => {
    expect(formatMoney(1599)).toBe("$1,599.00");
    expect(formatMoney("99.5")).toBe("$99.50");
  });

  test("understands prices that already look like money", () => {
    expect(formatMoney("$1,299.00")).toBe("$1,299.00");
  });

  test("treats missing values as zero", () => {
    expect(formatMoney(undefined)).toBe("$0.00");
    expect(formatMoney("abc")).toBe("$0.00");
  });
});

describe("imageUrl", () => {
  test("turns a file name into a backend image URL", () => {
    expect(imageUrl("gpu.jpg")).toBe(`${API_URL}/images/gpu.jpg`);
  });

  test("keeps full URLs and data URIs as they are", () => {
    expect(imageUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
    expect(imageUrl("data:image/png;base64,AAA")).toBe("data:image/png;base64,AAA");
  });

  test("returns an empty string when there is no image", () => {
    expect(imageUrl("")).toBe("");
    expect(imageUrl(null)).toBe("");
  });
});

describe("labels", () => {
  test("old hand-typed labels are understood", () => {
    expect(normalizeLabel("New ")).toBe("New");
    expect(isBestSeller({ label: "Best" })).toBe(true);
    expect(isBestSeller({ label: "Best Seller" })).toBe(true);
    expect(isBestSeller({ label: "New" })).toBe(false);
    expect(isBestSeller({ label: null })).toBe(false);
  });
});

describe("stock", () => {
  test(`"low stock" means 1 to ${LOW_STOCK} left`, () => {
    expect(isLowStock(0)).toBe(false);
    expect(isLowStock(1)).toBe(true);
    expect(isLowStock(LOW_STOCK)).toBe(true);
    expect(isLowStock(LOW_STOCK + 1)).toBe(false);
  });

  test("sold out only when the stock is known and zero", () => {
    expect(isSoldOut({ stock_quantity: 0 })).toBe(true);
    expect(isSoldOut({ stock_quantity: 3 })).toBe(false);
    expect(isSoldOut({})).toBe(false);
  });
});

describe("orderStatus", () => {
  test("gives customer-friendly labels", () => {
    expect(orderStatus("done")).toEqual({ key: "done", label: "Completed" });
    expect(orderStatus("PENDING")).toEqual({ key: "pending", label: "Pending" });
  });

  test("a missing status counts as pending", () => {
    expect(orderStatus(null).key).toBe("pending");
  });

  test("unknown statuses still show something readable", () => {
    expect(orderStatus("shipped")).toEqual({ key: "neutral", label: "Shipped" });
  });
});

describe("formatOrderDate", () => {
  test("formats a date as 'Oct 17, 2026'", () => {
    expect(formatOrderDate("2026-10-17T15:21:00").date).toBe("Oct 17, 2026");
  });

  test("handles missing or broken dates", () => {
    expect(formatOrderDate(null).date).toBe("—");
    expect(formatOrderDate("not a date").date).toBe("—");
  });
});

describe("toCartProduct", () => {
  test("gives the cart a full image URL and a price string", () => {
    const item = toCartProduct({ id: 1, name: "RTX", price: 499, image: "rtx.jpg", stock_quantity: 3 });
    expect(item.image).toBe(`${API_URL}/images/rtx.jpg`);
    expect(item.price).toBe("$499.00");
    expect(item.stock_quantity).toBe(3);
  });
});

describe("product addresses", () => {
  test("slugify makes clean, lowercase addresses", () => {
    expect(slugify("NVIDIA RTX 4090")).toBe("nvidia-rtx-4090");
    expect(slugify('32" QHD Curved')).toBe("32-qhd-curved");
    expect(slugify("  Gaming Laptop -- RTX 4070! ")).toBe("gaming-laptop-rtx-4070");
    expect(slugify("Café Écran")).toBe("cafe-ecran");
  });

  test("productPath puts the id first", () => {
    expect(productPath({ id: 12, name: "NVIDIA RTX 4090" })).toBe("/product/12-nvidia-rtx-4090");
    expect(productPath({ id: 7, name: "" })).toBe("/product/7");
  });

  test("productIdFromParam reads the number back", () => {
    expect(productIdFromParam("12-nvidia-rtx-4090")).toBe(12);
    expect(productIdFromParam("12")).toBe(12);
    expect(productIdFromParam("abc")).toBeNull();
    expect(productIdFromParam("-3")).toBeNull();
  });
});
