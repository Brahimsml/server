import React, { useContext, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCart";
import CloudDoneOutlinedIcon from "@mui/icons-material/CloudDoneOutlined";
import PhoneIphoneOutlinedIcon from "@mui/icons-material/PhoneIphoneOutlined";
import ProductsItem from "../Components/ProductsItem";
import { useWishlist } from "../Context/WishlistContext";
import { CartContext } from "../Context/CartContext";
import api from "../api";
import { formatMoney, isBestSeller, isSoldOut, toCartProduct } from "../utils/shop";
import "../Styles/theme.css";
import "../Styles/HomePage.css";
import "../Styles/Account.css";

// Saved products. Uses the live shop data (price, stock), so what you see is current.
const Wishlist = () => {
  const { items, inAccount } = useWishlist();
  const { addToCart, openMiniCart } = useContext(CartContext);
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

  // Saved products the shop doesn't show right now (hidden by the admin, or deleted) are left
  // out of the list but stay saved, so a product that's shown again comes back by itself.
  const ids = useMemo(() => new Set(items.map((p) => p.id)), [items]);
  const shownCount = live ? products.length : items.length;

  const inStock = products.filter((p) => !isSoldOut(p));
  const totalValue = products.reduce((sum, p) => sum + Number(p.price || 0), 0);

  // "Add all to cart": every saved product that's in stock, then show the cart
  const addAll = () => {
    inStock.forEach((p) => addToCart(toCartProduct(p), { silent: true }));
    openMiniCart();
  };

  // Empty wishlist: popular products to start from
  const popular = useMemo(() => {
    const pool = (live || []).filter((p) => !isSoldOut(p) && p.image);
    return [...pool.filter(isBestSeller), ...pool.filter((p) => !isBestSeller(p))].slice(0, 10);
  }, [live]);

  return (
    <section className="mt-page hp hp-wide hp-wishlist">
      <div className="mt-container">
        <header className="wl-head">
          <div>
            <span className="mt-eyebrow">Saved for later</span>
            <h1 className="mt-title">Wishlist</h1>
            <p className="mt-lead">
              {shownCount
                ? `${shownCount} saved ${shownCount === 1 ? "product" : "products"}${
                    live?.length ? ` · ${formatMoney(totalValue)} in total` : ""
                  }. Tap the heart to remove one.`
                : "Tap the heart on any product to save it here."}
            </p>
          </div>
          {shownCount > 0 && (
            <div className="wl-actions">
              <Link to="/shop" className="mt-btn mt-btn--secondary">
                Keep shopping
              </Link>
              {inStock.length > 0 && (
                <button type="button" className="mt-btn mt-btn--primary" onClick={addAll}>
                  <AddShoppingCartIcon fontSize="small" /> Add all to cart ({inStock.length})
                </button>
              )}
            </div>
          )}
        </header>

        <p className={`wl-where ${inAccount ? "" : "is-device"}`}>
          {inAccount ? (
            <>
              <CloudDoneOutlinedIcon fontSize="small" /> Saved in your account, so you'll see it on all your devices.
            </>
          ) : (
            <>
              <PhoneIphoneOutlinedIcon fontSize="small" />
              <span>
                Saved on this device only. <Link to="/login?redirect=/wishlist">Sign in</Link> to keep it in your account.
              </span>
            </>
          )}
        </p>

        {shownCount === 0 ? (
          <>
            <div className="mt-panel wl-empty">
              <div className="mt-empty__icon">
                <FavoriteBorderIcon fontSize="inherit" />
              </div>
              <div className="wl-empty__text">
                <h3>Your wishlist is empty</h3>
                <p>Save products you like and come back to them any time.</p>
              </div>
              <Link to="/shop" className="mt-btn mt-btn--primary">
                Browse the shop
              </Link>
            </div>

            {popular.length > 0 && (
              <div className="mt-box wl-popular">
                <div className="mt-section-head">
                  <div>
                    <h2>Popular right now</h2>
                  </div>
                </div>
                <ProductsItem products={popular} row showToolbar={false} showCategories={false} showPagination={false} />
              </div>
            )}
          </>
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
