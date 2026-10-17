/*
  MegaTech shop assistant (rule-based, no AI, free).

  Understands:
  - product search: category, price limits ("under $500", "between 1000 and 1500"),
    cheapest / best / best sellers / new, keywords ("wireless", "4k", "rtx 4090"), typos
  - follow-ups using the previous answer ("cheaper", "show more")
  - comparisons ("rtx 4090 vs rtx 4080")
  - a setup builder with a budget ("gaming setup for $2000")
  - store locations, opening hours, contact info
  - order tracking for signed-in customers
  - common questions (delivery, payment, warranty, returns, cancelling, account)

  Answers only use what the site really offers. Replies are structured so the
  chat widget can show product/store/order cards and suggestion buttons.
*/

const PHONE = "70 123 456";
const EMAIL = "support@megatech.com";
const RESULTS_PER_PAGE = 4;

const money = (n) =>
  Number(n || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });

const run = (db, sql, params = []) =>
  new Promise((resolve, reject) => db.query(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------
const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9$#.,\s-]/g, " ")
    .replace(/(\d),(\d{3})/g, "$1$2") // 1,500 -> 1500
    .replace(/[,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const singular = (w) => {
  if (w === "mice") return "mouse";
  if (/^[a-z]+$/.test(w) && w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
};

const levenshtein = (a, b) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
};

// Same word, or a small typo of it (letters only: "4080" must never match "4090")
const similar = (a, b) => {
  if (a === b) return true;
  if (!/^[a-z]+$/.test(a) || !/^[a-z]+$/.test(b)) return false;
  if (a.length < 4 || b.length < 4 || Math.abs(a.length - b.length) > 2) return false;
  return levenshtein(a, b) <= (Math.max(a.length, b.length) >= 8 ? 2 : 1);
};

const STOP = new Set(
  (
    "i me my mine we you your a an the is are am was be do does did have has had any some show find want wanna " +
    "looking look for need get buy please pls plz what whats which who can could would will like to of in on with " +
    "and or at from im about there it its that this these those one ones item items product products thing things " +
    "price prices cost costs how much many good great nice sell selling sold available stock got recommend " +
    "suggest suggestion something anything give tell list all see also just really very more less than hi hello hey " +
    "support supports work works compatible does doe "
  )
    .trim()
    .split(/\s+/)
);

// Category vocabulary: word -> key used to find the matching category in the database
const CATEGORY_WORDS = {
  gpu: "graphic", gpus: "graphic", graphic: "graphic", graphics: "graphic", "video card": "graphic",
  "graphics card": "graphic", "graphic card": "graphic", rtx: "graphic", radeon: "graphic", geforce: "graphic", nvidia: "graphic",
  monitor: "monitor", screen: "monitor", display: "monitor", ultrawide: "monitor",
  laptop: "laptop", notebook: "laptop",
  peripheral: "peripheral", accessory: "peripheral", accessorie: "peripheral",
  keyboard: "peripheral", mouse: "peripheral", headset: "peripheral", headphone: "peripheral",
  webcam: "peripheral", camera: "peripheral", mousepad: "peripheral", chair: "peripheral", hub: "peripheral",
};

// Words that only name a category (removed from search keywords)
const GENERIC_CATEGORY_WORDS = new Set(["gpu", "graphic", "graphics", "card", "monitor", "screen", "display", "laptop", "notebook", "peripheral", "accessory", "accessorie"]);

// Words that describe what kind of peripheral (also used as product keywords)
const PERIPHERAL_KINDS = ["keyboard", "mouse", "headset", "headphone", "webcam", "camera", "mousepad", "chair", "hub"];

// Different words for the same kind of product
const SYNONYMS = { headphone: "headset", earphone: "headset", earbud: "headset", mic: "headset", cam: "webcam", pad: "mousepad", "mouse pad": "mousepad", seat: "chair" };

const hasPhrase = (text, phrase) => (" " + text + " ").includes(" " + phrase + " ");
const hasAny = (text, list) => list.some((p) => hasPhrase(text, p));
const tokensOf = (text) => text.split(" ").filter(Boolean).map(singular);

// ---------------------------------------------------------------------------
// Understanding the question
// ---------------------------------------------------------------------------
const NUM = "\\$?\\s?(\\d+(?:\\.\\d+)?k?)\\s?\\$?";
const toNumber = (s) => {
  const m = String(s).match(/^(\d+(?:\.\d+)?)(k)?$/);
  return m ? parseFloat(m[1]) * (m[2] ? 1000 : 1) : null;
};

// Returns { min, max, cleaned } — cleaned is the text without the price words
const parsePrice = (text) => {
  let min = null;
  let max = null;
  let cleaned = text;
  const take = (re, fn) => {
    const m = cleaned.match(re);
    if (m) {
      fn(m);
      cleaned = cleaned.replace(m[0], " ");
    }
  };

  take(new RegExp(`(?:between|from)\\s${NUM}\\s(?:and|to|-)\\s${NUM}`), (m) => {
    min = toNumber(m[1]);
    max = toNumber(m[2]);
  });
  take(new RegExp(`(?:around|about|approximately|roughly|near)\\s${NUM}`), (m) => {
    const n = toNumber(m[1]);
    min = Math.round(n * 0.8);
    max = Math.round(n * 1.2);
  });
  take(
    new RegExp(`(?:under|below|less than|cheaper than|max|maximum|up to|at most|no more than|budget of|budget is|budget|within|<)\\s${NUM}`),
    (m) => (max = toNumber(m[1]))
  );
  take(new RegExp(`(?:over|above|more than|at least|minimum|min|starting at|>)\\s${NUM}`), (m) => (min = toNumber(m[1])));
  // a plain amount with a dollar sign ("laptop for $1200", "1500$ setup") is treated as the budget
  if (min === null && max === null) {
    take(/\$\s?(\d+(?:\.\d+)?k?)|(\d+(?:\.\d+)?k?)\s?\$|(\d+(?:\.\d+)?k?)\s?(?:dollars|usd)/, (m) => (max = toNumber(m[1] || m[2] || m[3])));
  }
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return { min, max, cleaned: cleaned.replace(/\s+/g, " ").trim() };
};

const detectSort = (text) => {
  if (hasAny(text, ["best seller", "best sellers", "bestseller", "bestsellers", "best selling", "popular", "trending", "most sold"]))
    return "bestsellers";
  if (hasAny(text, ["new arrival", "new arrivals", "newest", "latest", "new"])) return "new";
  if (hasAny(text, ["cheapest", "cheap", "cheaper", "affordable", "lowest", "low cost", "inexpensive", "budget"])) return "asc";
  if (hasAny(text, ["most expensive", "expensive", "premium", "high end", "highend", "top", "best", "strongest", "most powerful", "flagship", "fastest"]))
    return "desc";
  return null;
};

// Find which category the message is about (matches the real categories in the database)
const detectCategory = (text, categories) => {
  const tokens = tokensOf(text);
  // 1) exact category name ("graphics cards", or a category added by the admin)
  for (const c of categories) {
    const name = normalize(c.name);
    if (hasPhrase(text, name) || hasPhrase(text, tokensOf(name).join(" "))) return c;
  }
  // 2) vocabulary words (with typo tolerance), strongest signal first
  const keys = [];
  for (const phrase of Object.keys(CATEGORY_WORDS)) {
    if (phrase.includes(" ") ? hasPhrase(text, phrase) : tokens.some((t) => similar(t, phrase))) keys.push(CATEGORY_WORDS[phrase]);
  }
  for (const key of ["laptop", "monitor", "peripheral", "graphic"]) {
    if (keys.includes(key)) {
      const c = categories.find((cat) => normalize(cat.name).includes(key));
      if (c) return c;
    }
  }
  // 3) one-word match against admin-made categories ("keyboards" -> "Keyboards")
  for (const c of categories) {
    const words = tokensOf(normalize(c.name));
    if (words.some((w) => tokens.some((t) => similar(t, w)))) return c;
  }
  return null;
};

// Keywords left after removing stop words, category words and price words
const keywordsOf = (text, category) => {
  const catWords = new Set(category ? tokensOf(normalize(category.name)) : []);
  const words = text
    .split(" ")
    .filter((w) => w && !STOP.has(w)) // drop filler words before trimming plurals ("does" must not become "doe")
    .map(singular)
    .map((w) => SYNONYMS[w] || w);
  return words.filter(
    (t) =>
      t.length > 1 &&
      !STOP.has(t) &&
      !catWords.has(t) &&
      !["cheap", "cheapest", "cheaper", "best", "top", "budget", "expensive", "premium", "affordable", "new", "latest", "seller", "popular", "gaming"].includes(t) &&
      !GENERIC_CATEGORY_WORDS.has(t) // brands ("nvidia", "rtx") and kinds ("mouse") still narrow the search
  );
};

// How well a product matches the keywords (0 = no match)
const keywordScore = (product, keywords) => {
  if (!keywords.length) return 0;
  const nameTokens = tokensOf(normalize(product.name));
  const otherTokens = tokensOf(normalize(`${product.description || ""} ${product.category_name || ""}`));
  let score = 0;
  for (const k of keywords) {
    if (nameTokens.some((t) => t === k)) score += 3;
    else if (nameTokens.some((t) => similar(t, k))) score += 2;
    else if (otherTokens.some((t) => t === k || similar(t, k))) score += 1;
  }
  return score;
};

const isBestSeller = (p) => /best/i.test(p.label || "");
const isNew = (p) => /^new$/i.test(String(p.label || "").trim());
const inStock = (p) => Number(p.stock_quantity) > 0;

// Fields the chat widget needs for a product card / add to cart
const card = (p) => ({
  id: p.id,
  name: String(p.name || "").trim(),
  price: Number(p.price),
  image: p.image,
  category_name: p.category_name,
  stock_quantity: Number(p.stock_quantity),
  label: p.label,
  description: p.description,
});

const plural = (n, word, many = word + "s") => `${n} ${n === 1 ? word : many}`;
// "Graphics Cards" -> "graphics card"
const singularName = (category) => {
  const words = category.name.toLowerCase().split(" ");
  words[words.length - 1] = singular(words[words.length - 1]);
  return words.join(" ");
};
// $1,000 for whole amounts, $499.99 otherwise
const moneyShort = (n) => (Number(n) % 1 === 0 ? "$" + Number(n).toLocaleString("en-US") : money(n));

const priceText = (min, max) => {
  if (min !== null && max !== null) return ` between ${moneyShort(min)} and ${moneyShort(max)}`;
  if (max !== null) return ` under ${moneyShort(max)}`;
  if (min !== null) return ` over ${moneyShort(min)}`;
  return "";
};

// ---------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------
const DEFAULT_SUGGESTIONS = ["Best sellers", "Graphics cards under $1000", "Build a gaming setup for $2000", "Track my order", "Store locations"];

const HELP = {
  reply:
    "I can help you find products, compare them, put together a setup for your budget, track your orders, and find our stores. Try one of these:",
  suggestions: DEFAULT_SUGGESTIONS,
};

// Product search with filters; returns the answer object
const searchProducts = (products, opts) => {
  const { category, min, max, sort, keywords = [], offset = 0 } = opts;

  let list = products.filter((p) => {
    if (category && Number(p.category_id) !== Number(category.id)) return false;
    const price = Number(p.price);
    if (min !== null && min !== undefined && price < min) return false;
    if (max !== null && max !== undefined && price > max) return false;
    if (sort === "bestsellers" && !isBestSeller(p)) return false;
    return true;
  });

  // keywords narrow the list when they match something
  let scored = list.map((p) => ({ p, s: keywordScore(p, keywords) }));
  if (keywords.length && scored.some((x) => x.s > 0)) scored = scored.filter((x) => x.s > 0);

  scored.sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s;
    if (inStock(b.p) !== inStock(a.p)) return inStock(b.p) ? 1 : -1;
    if (sort === "asc") return a.p.price - b.p.price;
    if (sort === "desc") return b.p.price - a.p.price || (isBestSeller(b.p) ? 1 : 0) - (isBestSeller(a.p) ? 1 : 0);
    if (sort === "new") return (isNew(b.p) ? 1 : 0) - (isNew(a.p) ? 1 : 0) || b.p.id - a.p.id;
    return (isBestSeller(b.p) ? 1 : 0) - (isBestSeller(a.p) ? 1 : 0) || b.p.id - a.p.id;
  });
  list = scored.map((x) => x.p);

  const page = list.slice(offset, offset + RESULTS_PER_PAGE);
  return { all: list, page };
};

const describeResults = ({ all, page }, opts, products) => {
  const { category, min, max, sort, keywords = [], offset = 0 } = opts;
  const what = keywords.length ? `"${keywords.join(" ")}"` : category ? category.name.toLowerCase() : "products";
  const range = priceText(min, max);
  const context = { categoryId: category?.id ?? null, min, max, sort, keywords, offset, shown: page.map((p) => Number(p.price)) };

  if (!page.length) {
    if (offset > 0) return { reply: "That's everything I found. Want me to look for something else?", suggestions: DEFAULT_SUGGESTIONS };

    // nothing in that price range: offer the closest thing instead of a dead end
    if (min !== null || max !== null) {
      const relaxed = searchProducts(products, { ...opts, min: null, max: null, sort: max !== null ? "asc" : "desc" });
      if (relaxed.page.length) {
        const closest = relaxed.page[0];
        return {
          reply: `I couldn't find ${what}${range}. The closest is the ${closest.name} at ${money(closest.price)}.`,
          products: relaxed.page.slice(0, 3).map(card),
          suggestions: ["Show best sellers", "Contact support"],
          context: { ...context, min: null, max: null },
        };
      }
    }
    return {
      reply: `Sorry, I couldn't find ${what}${range}. Here's what we have instead:`,
      products: searchProducts(products, { sort: "bestsellers" }).page.map(card),
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const total = all.length;
  let reply;
  if (sort === "asc" && offset === 0 && !keywords.length) {
    reply = `The most affordable ${category ? singularName(category) : "option"}${range} is the ${page[0].name} at ${money(page[0].price)}.`;
  } else if (sort === "desc" && offset === 0 && !keywords.length) {
    reply = `Our top ${category ? singularName(category) : "pick"}${range} is the ${page[0].name} at ${money(page[0].price)}.`;
  } else if (sort === "bestsellers") {
    reply = `Here are our best sellers${category ? ` in ${category.name.toLowerCase()}` : ""}${range}:`;
  } else if (offset > 0) {
    reply = `Here are more ${what}${range}:`;
  } else {
    reply = `I found ${plural(total, "match", "matches")} for ${what}${range}${total > page.length ? `. Here are the top ${page.length}` : ""}:`;
  }

  const suggestions = [];
  if (offset + page.length < total) suggestions.push("Show more");
  if (page.length > 1 || min !== null || max !== null) suggestions.push("Show cheaper");
  if (page.length >= 2) suggestions.push(`Compare ${page[0].name} vs ${page[1].name}`);
  suggestions.push(category ? `Best sellers in ${category.name}` : "Build a gaming setup for $2000");

  const soldOut = page.filter((p) => !inStock(p)).length;
  if (soldOut) reply += ` (${plural(soldOut, "item")} currently sold out)`;

  return { reply, products: page.map(card), suggestions: suggestions.slice(0, 4), context };
};

// "rtx 4090 vs rtx 4080" -> the two best-matching products
const compareProducts = (text, products) => {
  const body = text.replace(/\b(compare|comparison|difference between|diff between|which is better|which one is better|whats the difference between)\b/g, " ");
  const parts = body.split(/\s(?:vs\.?|versus|or|and|with|to)\s/).map((s) => s.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const pick = (part, exclude) => {
    const kw = keywordsOf(part, null);
    if (!kw.length) return null;
    const ranked = products
      .filter((p) => p.id !== exclude)
      .map((p) => ({ p, s: keywordScore(p, kw) }))
      .filter((x) => x.s >= Math.min(3, kw.length * 2))
      .sort((a, b) => b.s - a.s);
    return ranked[0]?.p || null;
  };

  const a = pick(parts[0]);
  const b = a && pick(parts[1], a.id);
  if (!a || !b) return null;

  const diff = Math.abs(Number(a.price) - Number(b.price));
  const cheaper = Number(a.price) <= Number(b.price) ? a : b;
  const lines = [
    `${a.name}: ${money(a.price)}, ${a.category_name}, ${inStock(a) ? `${a.stock_quantity} in stock` : "sold out"}${isBestSeller(a) ? ", best seller" : ""}`,
    `${b.name}: ${money(b.price)}, ${b.category_name}, ${inStock(b) ? `${b.stock_quantity} in stock` : "sold out"}${isBestSeller(b) ? ", best seller" : ""}`,
  ];
  const verdict = diff
    ? `The ${cheaper.name} is ${money(diff)} cheaper. The other is the higher-end choice if your budget allows.`
    : "They cost the same.";

  return {
    reply: `Here's how they compare:\n• ${lines[0]}\n• ${lines[1]}\n${verdict}`,
    products: [card(a), card(b)],
    suggestions: [`Best ${a.category_name}`, "Build a gaming setup for $2000", "Contact support"],
  };
};

// Pick a graphics card, monitor and peripherals that fit the budget
const buildSetup = (products, categories, budget) => {
  const byKey = (key) => {
    const c = categories.find((cat) => normalize(cat.name).includes(key));
    return c ? products.filter((p) => Number(p.category_id) === Number(c.id) && inStock(p)) : [];
  };
  const gpus = byKey("graphic");
  const monitors = byKey("monitor");
  const peripherals = byKey("peripheral");
  const kind = (k) => peripherals.filter((p) => tokensOf(normalize(p.name)).includes(k)).sort((a, b) => a.price - b.price);

  const pickUnder = (list, limit) =>
    list.filter((p) => Number(p.price) <= limit).sort((a, b) => b.price - a.price || (isBestSeller(b) ? 1 : 0) - (isBestSeller(a) ? 1 : 0))[0];

  let picks = [];
  if (budget) {
    const gpu = pickUnder(gpus, budget * 0.5) || pickUnder(gpus, budget);
    let left = budget - (gpu ? Number(gpu.price) : 0);
    const monitor = pickUnder(monitors, Math.min(left, budget * 0.35)) || pickUnder(monitors, left);
    left -= monitor ? Number(monitor.price) : 0;
    picks = [gpu, monitor].filter(Boolean);
    for (const k of ["keyboard", "mouse", "headset"]) {
      const p = kind(k).find((x) => Number(x.price) <= left);
      if (p) {
        picks.push(p);
        left -= Number(p.price);
      }
    }
  } else {
    const best = (list) => list.find(isBestSeller) || list.sort((a, b) => b.price - a.price)[0];
    picks = [best(gpus), best(monitors), kind("keyboard")[0], kind("mouse")[0], kind("headset").find(isBestSeller) || kind("headset")[0]].filter(Boolean);
  }

  if (!picks.length) {
    return {
      reply: budget
        ? `A full setup doesn't fit in ${moneyShort(budget)} with what's in stock right now. Want to see our most affordable graphics cards and monitors instead?`
        : "I couldn't put a setup together right now. Try searching for a graphics card or monitor.",
      suggestions: ["Cheapest graphics card", "Cheapest monitor", "Contact support"],
    };
  }

  const total = picks.reduce((s, p) => s + Number(p.price), 0);
  const list = picks.map((p) => `• ${p.name}: ${money(p.price)}`).join("\n");
  return {
    reply: `${budget ? `Here's a gaming setup for ${moneyShort(budget)}` : "Here's a popular gaming setup"}:\n${list}\nTotal: ${money(total)}${budget ? ` (${money(budget - total)} left in your budget)` : ""}. Add the parts you like to your cart.`,
    products: picks.map(card),
    suggestions: budget ? [`Gaming setup for $${Math.round(budget * 1.5)}`, `Gaming setup for $${Math.round(budget * 0.7)}`, "Contact support"] : ["Gaming setup for $1500", "Gaming setup for $3000", "Best sellers"],
  };
};

const STATUS_LABEL = { pending: "Pending", processing: "Processing", done: "Completed", cancelled: "Cancelled" };
const STATUS_MEANING = {
  pending: "We've received it and it's waiting to be processed.",
  processing: "Our team is preparing it now.",
  done: "It's completed.",
  cancelled: "It was cancelled.",
};

const orderCard = (o) => ({
  id: o.id,
  status: String(o.status || "pending").toLowerCase(),
  statusLabel: STATUS_LABEL[String(o.status || "pending").toLowerCase()] || o.status,
  total: Number(o.total),
  created_at: o.created_at,
});

const trackOrders = async (db, user, text) => {
  if (!user) {
    return {
      reply: "Sign in to your account and I'll show you the status of your orders.",
      actions: [{ label: "Sign in", to: "/login?redirect=/my-orders" }],
      suggestions: ["How do I place an order?", "Contact support"],
    };
  }

  const idMatch = text.match(/#\s?(\d+)|order\s(?:number\s|no\s|id\s)?(\d+)/);
  const orderId = idMatch ? Number(idMatch[1] || idMatch[2]) : null;

  if (orderId) {
    const rows = await run(db, "SELECT id, status, total, created_at FROM orders WHERE id=? AND user_id=?", [orderId, user.id]);
    if (!rows.length) {
      return {
        reply: `I couldn't find order #${orderId} on your account. Here are your latest orders:`,
        ...(await latestOrders(db, user)),
      };
    }
    const o = orderCard(rows[0]);
    return {
      reply: `Order #${o.id} is ${o.statusLabel.toLowerCase()}. ${STATUS_MEANING[o.status] || ""} You get an email whenever its status changes.`,
      orders: [o],
      actions: [{ label: "View order", to: `/my-orders/${o.id}` }],
      suggestions: ["Show all my orders", "Contact support"],
    };
  }
  return latestOrders(db, user, true);
};

const latestOrders = async (db, user, withReply) => {
  const rows = await run(db, "SELECT id, status, total, created_at FROM orders WHERE user_id=? ORDER BY id DESC LIMIT 3", [user.id]);
  if (!rows.length) {
    return {
      reply: "You haven't placed any orders yet. Want help finding something?",
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }
  const orders = rows.map(orderCard);
  const first = orders[0];
  return {
    ...(withReply
      ? { reply: `Your latest order, #${first.id}, is ${first.statusLabel.toLowerCase()}. ${STATUS_MEANING[first.status] || ""}` }
      : {}),
    orders,
    actions: [{ label: "All my orders", to: "/my-orders" }],
    suggestions: ["Contact support", "Best sellers"],
  };
};

const storeCard = (s) => ({ id: s.id, name: s.name, address: s.address, tel: s.tel, lat: s.lat, lng: s.lng, image: s.image });

const findStores = (stores, text, hoursQuestion) => {
  const tokens = tokensOf(text);
  // "store in tripoli" -> only stores whose name/address mention it
  const filtered = stores.filter((s) => {
    const words = tokensOf(normalize(`${s.name} ${s.address}`));
    return tokens.some((t) => t.length >= 4 && !STOP.has(t) && !["store", "stor", "location", "branch", "shop", "where", "near", "open", "hour", "close", "address"].includes(t) && words.some((w) => similar(w, t)));
  });
  const list = filtered.length ? filtered : stores;

  if (!list.length) {
    return { reply: "We don't have store locations listed yet. You can still order online.", suggestions: DEFAULT_SUGGESTIONS };
  }
  const reply = hoursQuestion
    ? "Opening hours can differ by store, so it's best to call before you visit:"
    : filtered.length
    ? `Here's our store${list.length > 1 ? "s" : ""} matching that:`
    : `We have ${plural(list.length, "store")}. Tap Call or Directions:`;

  return {
    reply,
    stores: list.map(storeCard),
    actions: [{ label: "See all locations", to: "/menu" }],
    suggestions: ["Contact support", "Best sellers"],
  };
};

const CONTACT = {
  reply: `You can reach our team by phone at ${PHONE} or by email at ${EMAIL}. You can also send a message from the Contact page, and we usually reply within 24 hours.`,
  actions: [{ label: "Contact page", to: "/contact" }],
  suggestions: ["Store locations", "Track my order"],
};

// Common questions. Answers only use what the site really offers.
const FAQ = [
  {
    match: ["how do i order", "how to order", "how can i order", "how do i buy", "how to buy", "place an order", "how does checkout work", "checkout", "how to checkout", "how do i pay"],
    answer: {
      reply:
        "Ordering is easy:\n1. Add products to your cart.\n2. Open the cart and sign in (or create a free account).\n3. Enter your name, phone and delivery address, then tap Place order.\nYou'll get a confirmation email, and you can follow the order under My orders.",
      actions: [{ label: "Go to cart", to: "/cart" }],
      suggestions: ["Best sellers", "Track my order"],
    },
  },
  {
    match: ["payment", "pay", "paying", "credit card", "card payment", "cash", "cash on delivery", "visa", "mastercard"],
    answer: {
      reply: `Checkout doesn't ask for card details. You place the order with your name, phone and address, and you get an email confirmation. For payment options, our team is happy to help at ${PHONE}.`,
      actions: [{ label: "Contact us", to: "/contact" }],
      suggestions: ["How do I place an order?", "Delivery"],
    },
  },
  {
    match: ["warranty", "guarantee", "guaranty", "broken", "defective", "faulty", "repair"],
    answer: {
      reply: `Our products come with the manufacturer's warranty. For a warranty question or claim, contact us with your order number at ${PHONE} or ${EMAIL}.`,
      actions: [{ label: "Contact us", to: "/contact" }],
      suggestions: ["Track my order", "Store locations"],
    },
  },
  {
    match: ["delivery", "deliver", "shipping", "ship", "shipment", "how long", "when will i get", "when will it arrive", "arrive"],
    answer: {
      reply: `After you order, you can follow its status under My orders, and we email you whenever it changes. For delivery times to your area, call us at ${PHONE}.`,
      actions: [{ label: "My orders", to: "/my-orders" }],
      suggestions: ["Track my order", "Store locations"],
    },
  },
  {
    match: ["return", "returns", "refund", "refunds", "exchange", "money back", "send back"],
    answer: {
      reply: `For returns, exchanges or refunds, please contact our support team with your order number at ${PHONE} or ${EMAIL}, and we'll help you.`,
      actions: [{ label: "Contact us", to: "/contact" }],
      suggestions: ["Track my order"],
    },
  },
  {
    match: ["cancel", "cancel my order", "cancellation"],
    answer: {
      reply: `To cancel an order, contact us as soon as possible with your order number at ${PHONE}. You'll get an email once it's cancelled.`,
      actions: [{ label: "Contact us", to: "/contact" }],
      suggestions: ["Track my order"],
    },
  },
  {
    match: ["account", "sign up", "signup", "register", "create account", "login", "log in", "sign in", "password"],
    answer: {
      reply: "You can create a free account or sign in from the Sign in page. An account lets you check out and track your orders.",
      actions: [{ label: "Sign in", to: "/login" }],
      suggestions: ["How do I place an order?", "Best sellers"],
    },
  },
];

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
module.exports = function createChatbot({ db, jwt, secret }) {
  return async (req, res) => {
    const raw = typeof req.body?.message === "string" ? req.body.message.slice(0, 500) : "";
    if (!raw.trim()) return res.status(400).json({ reply: "Please type a question." });

    // Signed-in customer? (only used for order tracking)
    let user = null;
    const auth = req.headers.authorization;
    if (auth) {
      try {
        const decoded = jwt.verify(auth.split(" ")[1], secret);
        if (decoded.role === "user") user = decoded;
      } catch {
        // expired/invalid token: treat as signed out
      }
    }

    try {
      const answer = await respond(normalize(raw), req.body?.context || null, user);
      res.json(answer);
    } catch (err) {
      console.error("❌ Chatbot error:", err);
      res.status(500).json({ reply: "Sorry, something went wrong on my side. Please try again in a moment." });
    }
  };

  async function respond(text, context, user) {
    const [products, categories, stores] = await Promise.all([
      run(db, "SELECT p.*, c.name AS category_name FROM products p JOIN categories c ON p.category_id = c.id"),
      run(db, "SELECT * FROM categories"),
      run(db, "SELECT * FROM places"),
    ]);
    products.forEach((p) => (p.price = Number(p.price)));

    const tokens = tokensOf(text);

    // ----- small talk -----
    const greetingWords = ["hi", "hello", "hey", "hiya", "yo", "salam", "marhaba", "good morning", "good afternoon", "good evening", "bonjour", "hii", "helo"];
    const isGreeting = hasAny(text, greetingWords);
    if (isGreeting && tokens.length <= 3) {
      return { reply: "Hi! I'm the MegaTech assistant. What are you looking for today?", suggestions: DEFAULT_SUGGESTIONS };
    }
    if (hasAny(text, ["thanks", "thank you", "thank", "thx", "ty", "merci", "appreciate it"]) && tokens.length <= 5) {
      return { reply: "You're welcome! Anything else I can help with?", suggestions: DEFAULT_SUGGESTIONS };
    }
    if (hasAny(text, ["bye", "goodbye", "see you", "cya", "good night"]) && tokens.length <= 4) {
      return { reply: "Thanks for visiting MegaTech. Have a great day!" };
    }
    if (hasAny(text, ["what can you do", "who are you", "what are you", "are you a bot", "are you human"]) ||
        (hasAny(text, ["help", "menu", "options"]) && tokens.length <= 3)) {
      return HELP;
    }

    // ----- people and contact -----
    if (hasAny(text, ["contact", "contact support", "customer support", "support team", "human", "agent", "real person", "talk to someone", "speak to someone", "talk to a person", "customer service", "phone number", "your number", "your email", "call you", "whatsapp"])) {
      return CONTACT;
    }

    // ----- order tracking -----
    const asksHowToOrder = hasAny(text, ["how do i order", "how to order", "how can i order", "place an order", "how do i buy", "how to buy"]);
    if (
      !asksHowToOrder &&
      (hasAny(text, ["my order", "my orders", "track", "tracking", "order status", "status of my order", "where is my order", "wheres my order", "show all my orders"]) ||
        /#\s?\d+/.test(text) ||
        /\border\s(?:number\s|no\s|id\s)?\d+/.test(text))
    ) {
      return trackOrders(db, user, text);
    }

    // ----- common questions -----
    for (const f of FAQ) {
      if (hasAny(text, f.match)) {
        return f.answer;
      }
    }

    // ----- stores -----
    const hoursQuestion = hasAny(text, ["opening hours", "open", "opens", "hours", "closing", "close", "closes", "working hours", "what time"]);
    if (hoursQuestion || hasAny(text, ["store", "stores", "location", "locations", "branch", "branches", "shop near", "address", "where are you", "where is your", "near me", "visit"])) {
      if (!detectCategory(text, categories)) return findStores(stores, text, hoursQuestion);
    }

    // ----- comparisons -----
    if (hasAny(text, ["vs", "versus", "compare", "comparison", "difference between", "which is better", "which one is better"])) {
      const comparison = compareProducts(text, products);
      if (comparison) return comparison;
    }

    // ----- setup builder -----
    if (hasAny(text, ["setup", "set up", "build", "pc build", "gaming setup", "battlestation", "full set", "complete set", "starter kit"])) {
      const { max } = parsePrice(text);
      return buildSetup(products, categories, max);
    }

    // ----- product search -----
    const price = parsePrice(text);
    const category = detectCategory(price.cleaned, categories);
    const sort = detectSort(price.cleaned);
    const keywords = keywordsOf(price.cleaned, category);

    // follow-ups like "cheaper" / "show more" reuse the previous search
    const followUp =
      context &&
      !category &&
      !keywords.filter((k) => !["more", "cheaper", "other", "another", "next", "else", "option", "show", "expensive", "better"].includes(k)).length &&
      hasAny(text, ["more", "show more", "next", "cheaper", "something cheaper", "anything cheaper", "less expensive", "more expensive", "better", "other", "others", "another", "else"]);

    if (followUp) {
      const prevCategory = categories.find((c) => Number(c.id) === Number(context.categoryId)) || null;
      const shown = Array.isArray(context.shown) ? context.shown.map(Number).filter((n) => !Number.isNaN(n)) : [];
      const prev = {
        category: prevCategory,
        min: Number.isFinite(Number(context.min)) && context.min !== null ? Number(context.min) : null,
        max: Number.isFinite(Number(context.max)) && context.max !== null ? Number(context.max) : null,
        sort: context.sort || null,
        keywords: Array.isArray(context.keywords) ? context.keywords.slice(0, 5).map(String) : [],
        offset: Number(context.offset) || 0,
      };
      const what = prevCategory ? singularName(prevCategory) : "option";
      if (hasAny(text, ["cheaper", "less expensive", "something cheaper", "anything cheaper"])) {
        const opts = { ...prev, max: shown.length ? Math.min(...shown) - 0.01 : prev.max, sort: "desc", offset: 0 };
        const result = searchProducts(products, opts);
        if (!result.page.length && shown.length) {
          return { reply: `That's already our most affordable ${what}${prev.keywords.length ? ` for "${prev.keywords.join(" ")}"` : ""}, at ${money(Math.min(...shown))}.`, suggestions: DEFAULT_SUGGESTIONS };
        }
        return describeResults(result, opts, products);
      }
      if (hasAny(text, ["more expensive", "better"])) {
        const opts = { ...prev, min: shown.length ? Math.max(...shown) + 0.01 : prev.min, max: null, sort: "asc", offset: 0 };
        const result = searchProducts(products, opts);
        if (!result.page.length && shown.length) {
          return { reply: `That's already our top ${what}, at ${money(Math.max(...shown))}.`, suggestions: DEFAULT_SUGGESTIONS };
        }
        return describeResults(result, opts, products);
      }
      const opts = { ...prev, offset: prev.offset + RESULTS_PER_PAGE };
      return describeResults(searchProducts(products, opts), opts, products);
    }

    if (category || sort || price.min !== null || price.max !== null || keywords.length) {
      const opts = { category, min: price.min, max: price.max, sort, keywords, offset: 0 };
      const result = searchProducts(products, opts);

      // keywords that matched nothing at all and no category: be honest instead of guessing
      if (!category && !sort && price.min === null && price.max === null && !result.all.some((p) => keywordScore(p, keywords) > 0)) {
        return {
          reply: "I'm not sure I understood that. I can search products, build a setup for your budget, track orders or show our stores.",
          suggestions: DEFAULT_SUGGESTIONS,
        };
      }
      return describeResults(result, opts, products);
    }

    return {
      reply: "I'm not sure I understood that. I can search products, build a setup for your budget, track orders or show our stores.",
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }
};
