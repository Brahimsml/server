import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ProductsItem from "../Components/ProductsItem";
import { useWishlist } from "../Context/WishlistContext";
import api from "../api";
import "../Styles/theme.css";
import "../Styles/HomePage.css";
import "../Styles/Account.css";

// Saved products. Uses the live shop data (price, stock), so what you see is current.
const Wishlist = () => {
  const { items, remove, inAccount } = useWishlist();
  const [live, setLive] = useState(null);

  useEffect(() => {
    document.title = "Wishlist | MegaTech";
    api
      .get("/products")
      .then((res) => setLive(Array.isArray(res.data) ? res.data : []))
      .catch(() => setLive([]));
    return () => {
      document.title = "MegaTech | PC Components & Gaming Gear";
    };
  }, []);

  // Saved products that are still in the shop, with today's price and stock;
  // if the shop couldn't load, show the saved copies
  const products = useMemo(() => {
    if (!live) return [];
    if (!live.length) return items;
    const byId = new Map(live.map((p) => [p.id, p]));
    return items.map((p) => byId.get(p.id)).filter(Boolean);
  }, [items, live]);

  // Drop products that were removed from the shop
  useEffect(() => {
    if (!live?.length) return;
    const ids = new Set(live.map((p) => p.id));
    items.filter((p) => !ids.has(p.id)).forEach((p) => remove(p.id));
  }, [live, items, remove]);

  const ids = useMemo(() => new Set(items.map((p) => p.id)), [items]);

  return (
    <section className="mt-page hp hp-wide hp-wishlist">
      <div className="mt-container">
        <header className="wl-head">
          <div>
            <span className="mt-eyebrow">Saved for later</span>
            <h1 className="mt-title">Wishlist</h1>
            <p className="mt-lead">
              {items.length
                ? `${items.length} saved ${items.length === 1 ? "product" : "products"}. Tap the heart to remove one.`
                : "Tap the heart on any product to save it here."}
            </p>
            <p className="wl-where">
              {inAccount ? (
                "Saved in your account, so you'll see it on all your devices."
              ) : (
                <>
                  Saved on this device only. <Link to="/login?redirect=/wishlist">Sign in</Link> to keep it in your account.
                </>
              )}
            </p>
          </div>
          {items.length > 0 && (
            <Link to="/shop" className="mt-btn mt-btn--secondary">
              Keep shopping
            </Link>
          )}
        </header>

        {items.length === 0 ? (
          <div className="mt-panel mt-empty wl-empty">
            <div className="mt-empty__icon">
              <FavoriteBorderIcon fontSize="inherit" />
            </div>
            <h3>Your wishlist is empty</h3>
            <p>Save products you like and come back to them any time.</p>
            <Link to="/shop" className="mt-btn mt-btn--primary">
              Browse the shop
            </Link>
          </div>
        ) : (
          <ProductsItem
            products={products}
            loading={!live}
            filter={(p) => ids.has(p.id)}
            showToolbar={false}
            showCategories={false}
            showPagination={false}
          />
        )}
      </div>
    </section>
  );
};

export default Wishlist;
