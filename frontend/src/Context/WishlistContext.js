import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/*
  Wishlist ("save for later"). Kept in the browser, so it works without an account,
  like on most shops. Only a small copy of each product is stored; the shop shows
  the live price and stock when the products load.
*/
const WISHLIST_KEY = "mt-wishlist";

const load = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

const snapshot = (p) => ({
  id: p.id,
  name: p.name,
  price: p.price,
  image: p.image,
  category_name: p.category_name,
  label: p.label,
  stock_quantity: p.stock_quantity,
  description: p.description,
});

export const WishlistContext = createContext({
  items: [],
  isSaved: () => false,
  toggle: () => {},
  remove: () => {},
});

export const WishlistProvider = ({ children }) => {
  const [items, setItems] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
    } catch {}
  }, [items]);

  // Another tab changed the list
  useEffect(() => {
    const onStorage = (e) => e.key === WISHLIST_KEY && setItems(load());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isSaved = useCallback((id) => items.some((p) => p.id === id), [items]);

  // Save the product, or remove it if it's already saved
  const toggle = useCallback((product) => {
    setItems((list) =>
      list.some((p) => p.id === product.id) ? list.filter((p) => p.id !== product.id) : [snapshot(product), ...list]
    );
  }, []);

  const remove = useCallback((id) => setItems((list) => list.filter((p) => p.id !== id)), []);

  const value = useMemo(() => ({ items, isSaved, toggle, remove }), [items, isSaved, toggle, remove]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => useContext(WishlistContext);
