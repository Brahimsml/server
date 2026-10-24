import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import { clearUserSession, getUserToken } from "../utils/auth";

/*
  Wishlist ("save for later"), like on big shops:
  - signed in: saved in the customer's account, so it's the same on every device
  - signed out: saved in this browser
  - signing in adds anything saved in the browser to the account (then the browser copy is cleared)
*/
const WISHLIST_KEY = "mt-wishlist";

const loadLocal = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(WISHLIST_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

const saveLocal = (items) => {
  try {
    if (items.length) localStorage.setItem(WISHLIST_KEY, JSON.stringify(items));
    else localStorage.removeItem(WISHLIST_KEY);
  } catch {}
};

// Small copy of a product for the browser list (the shop shows live price and stock)
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

const authHeader = (token) => ({ headers: { Authorization: `Bearer ${token}` } });
const isAuthError = (err) => err?.response?.status === 401 || err?.response?.status === 403;

export const WishlistContext = createContext({
  items: [],
  isSaved: () => false,
  toggle: () => {},
  remove: () => {},
  inAccount: false,
});

export const WishlistProvider = ({ children }) => {
  const [token, setToken] = useState(getUserToken);
  const [items, setItems] = useState(() => (getUserToken() ? [] : loadLocal()));
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Sign-in expired while shopping: carry on with a browser wishlist
  const dropSession = useCallback(() => {
    clearUserSession();
    setToken(null);
  }, []);

  // Signed in: move the browser list into the account, then load the account list
  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    const local = loadLocal();
    api
      .post("/wishlist/merge", { ids: local.map((p) => p.id) }, authHeader(token))
      .then((res) => {
        if (!alive) return;
        saveLocal([]);
        setItems(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        if (!alive) return;
        if (isAuthError(err)) {
          dropSession();
          setItems(local);
        }
      });
    return () => {
      alive = false;
    };
  }, [token, dropSession]);

  // Signed out: keep the browser copy up to date, and follow changes from other tabs
  useEffect(() => {
    if (!token) saveLocal(items);
  }, [items, token]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === WISHLIST_KEY && !token) setItems(loadLocal());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [token]);

  const isSaved = useCallback((id) => items.some((p) => p.id === id), [items]);

  const remove = useCallback(
    (id) => {
      const before = itemsRef.current;
      setItems((list) => list.filter((p) => p.id !== id));
      if (!token) return;
      api.delete(`/wishlist/${id}`, authHeader(token)).catch((err) => {
        if (isAuthError(err)) return dropSession();
        setItems(before); // couldn't save the change: show the list as it really is
      });
    },
    [token, dropSession]
  );

  // Save the product, or remove it if it's already saved
  const toggle = useCallback(
    (product) => {
      if (itemsRef.current.some((p) => p.id === product.id)) {
        remove(product.id);
        return;
      }
      const before = itemsRef.current;
      setItems((list) => [snapshot(product), ...list]);
      if (!token) return;
      api.post(`/wishlist/${product.id}`, null, authHeader(token)).catch((err) => {
        if (isAuthError(err)) return dropSession();
        setItems(before);
      });
    },
    [token, remove, dropSession]
  );

  const value = useMemo(
    () => ({ items, isSaved, toggle, remove, inAccount: Boolean(token) }),
    [items, isSaved, toggle, remove, token]
  );
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
};

export const useWishlist = () => useContext(WishlistContext);
