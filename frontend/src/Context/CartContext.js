import { createContext, useCallback, useEffect, useMemo, useState } from "react";

export const CartContext = createContext();

const CART_KEY = "cart";

// Load the saved cart so it survives a page refresh
const loadCart = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(CART_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

const CLOSED_MINI_CART = { open: false, lastAddedId: null, notice: "" };

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(loadCart);

  // Mini cart that drops down from the navbar cart icon.
  // It opens when something is added and stays open until the user closes it.
  const [miniCart, setMiniCart] = useState(CLOSED_MINI_CART);

  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch {
      // storage full or blocked: cart still works for this visit
    }
  }, [cart]);

  const openMiniCart = useCallback(() => {
    setMiniCart({ open: true, lastAddedId: null, notice: "" });
  }, []);

  const closeMiniCart = useCallback(() => {
    setMiniCart(CLOSED_MINI_CART);
  }, []);

  // Stock checks run here (not inside setCart) so each notice shows only once.
  // Returns true when the item was added, so buttons can show "Added".
  // silent: don't open the mini cart (the chat assistant shows its own confirmation)
  // quantity: how many to add (the product page has a quantity picker); never more than stock
  const addToCart = (product, { silent = false, quantity = 1 } = {}) => {
    const amount = Math.max(1, Math.floor(Number(quantity)) || 1);
    const existing = cart.find((item) => item.id === product.id);

    // ✅ ADDED: check product stock
    const stock = Number(product.stock_quantity) || 0;

    if (stock <= 0) {
      if (!silent) setMiniCart({ open: true, lastAddedId: null, notice: `${product.name} is sold out.` });
      return false;
    }

    if (existing) {
      const currentQty = existing.quantity || 1;

      // ✅ ADDED: stop adding more than stock
      if (currentQty >= stock) {
        if (!silent) {
          setMiniCart({
            open: true,
            lastAddedId: null,
            notice: `You already have all ${stock} available ${product.name} in your cart.`,
          });
        }
        return false;
      }

      const nextQty = Math.min(stock, currentQty + amount);
      setCart((prev) =>
        prev.map((item) => (item.id === product.id ? { ...item, quantity: nextQty } : item))
      );
    } else {
      // (checked again inside, so two very fast clicks can't add the same product twice)
      setCart((prev) =>
        prev.some((item) => item.id === product.id)
          ? prev.map((item) =>
              item.id === product.id ? { ...item, quantity: Math.min(stock, (item.quantity || 1) + amount) } : item
            )
          : [...prev, { ...product, quantity: Math.min(stock, amount) }]
      );
    }

    if (!silent) setMiniCart({ open: true, lastAddedId: product.id, notice: "" });
    return true;
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item.id !== id));
  };

  const updateQuantity = (id, qty) => {
    if (qty < 1) return;

    const item = cart.find((it) => it.id === id);
    if (!item) return;

    // ✅ ADDED: stop cart + button from going above stock (the + button is disabled at the limit)
    const stock = Number(item.stock_quantity) || 0;
    if (qty > stock) return;

    setCart((prev) =>
      prev.map((it) => (it.id === id ? { ...it, quantity: qty } : it))
    );
  };

  const clearCart = () => {
    // Remove right away: Login reloads the page straight after placing an order
    try {
      localStorage.removeItem(CART_KEY);
    } catch {}
    setCart([]);
  };

  const cartCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        cartCount,
        miniCart,
        openMiniCart,
        closeMiniCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
