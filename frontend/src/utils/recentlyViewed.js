/*
  "Recently viewed": the last products this visitor opened, newest first.
  Kept in this browser only (no account needed), like big shops do.
*/
const KEY = "recentlyViewed";
const MAX = 12;

export const getRecentlyViewed = () => {
  try {
    const ids = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(ids) ? ids.filter((id) => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
};

export const addRecentlyViewed = (id) => {
  const productId = Number(id);
  if (!Number.isInteger(productId)) return;
  try {
    const ids = [productId, ...getRecentlyViewed().filter((x) => x !== productId)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {}
};

export const clearRecentlyViewed = () => {
  try {
    localStorage.removeItem(KEY);
  } catch {}
};
