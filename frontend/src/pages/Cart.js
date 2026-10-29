import React, { useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { CartContext } from "../Context/CartContext";
import { Link, useNavigate } from "react-router-dom";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import "../Styles/card.css";
import "../Styles/theme.css";
import "../Styles/HomePage.css";
import ProductsItem from "../Components/ProductsItem";
import api from "../api";
import { API_URL } from "../api";
import { DEFAULT_DELIVERY_FEE, PAYMENT_METHODS, isBestSeller, isLowStock, isSoldOut, productPath } from "../utils/shop";
import { useWishlist } from "../Context/WishlistContext";
import { clearUserSession, getUser, getUserToken } from "../utils/auth";
import usePageTitle from "../utils/usePageTitle";

const PAYMENT_ICONS = { cash: PaymentsOutlinedIcon };

// Neutral grey box shown when a product image fails to load
const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><rect width="100%" height="100%" fill="#2a241a"/><text x="50%" y="50%" fill="#8a7d63" font-family="sans-serif" font-size="14" text-anchor="middle" dominant-baseline="middle">No image</text></svg>'
  );

const toNumber = (price) => Number(String(price).replace(/[$,]/g, "")) || 0;

const formatMoney = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const Cart = () => {
  usePageTitle("Shopping cart");
  const ctx = useContext(CartContext);
  const { cart, removeFromCart, updateQuantity } = ctx;
  const clearCart = ctx.clearCart || (() => {});
  const navigate = useNavigate();
  const { items: wishlist, isSaved, toggle: toggleWishlist } = useWishlist();

  // Checkout needs a signed-in user; after login they come back here to confirm
  const token = getUserToken();
  const user = getUser();
  const goToLogin = (mode) =>
    navigate(`/login?redirect=/cart${mode === "register" ? "&mode=register" : ""}`);

  const [customer, setCustomer] = useState({
    customer_name: user?.name || "",
    customer_phone: "",
    customer_address: "",
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [saveDetails, setSaveDetails] = useState(true);

  // Products to suggest under the cart: popular ones when it's empty,
  // otherwise more from the same categories as what's in it
  const [allProducts, setAllProducts] = useState(null);
  useEffect(() => {
    api
      .get("/products")
      .then((res) => setAllProducts(Array.isArray(res.data) ? res.data : []))
      .catch(() => setAllProducts([]));
  }, []);

  const suggestions = useMemo(() => {
    if (!allProducts) return [];
    const inCart = new Set(cart.map((item) => item.id));
    const pool = allProducts.filter((p) => !isSoldOut(p) && p.image && !inCart.has(p.id));
    const cats = new Set(cart.map((item) => item.category_id));
    const related = pool.filter((p) => cats.has(p.category_id));
    const best = pool.filter((p) => isBestSeller(p) && !cats.has(p.category_id));
    const rest = pool.filter((p) => !isBestSeller(p) && !cats.has(p.category_id));
    return [...related, ...best, ...rest].slice(0, 10);
  }, [allProducts, cart]);

  // "Save for later": move the item to the wishlist
  const saveForLater = (item) => {
    if (!isSaved(item.id)) toggleWishlist(item);
    removeFromCart(item.id);
  };

  // Fill in the phone and address saved on the account (My account, or the last order)
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        const me = res.data || {};
        setCustomer((c) => ({
          customer_name: c.customer_name || me.name || "",
          customer_phone: c.customer_phone || me.phone || "",
          customer_address: c.customer_address || me.address || "",
        }));
      })
      .catch(() => {});
  }, [token]);
  const [deliveryFee, setDeliveryFee] = useState(DEFAULT_DELIVERY_FEE);

  // The delivery fee is set on the server (DELIVERY_FEE in backend/.env)
  useEffect(() => {
    axios
      .get(`${API_URL}/checkout-info`)
      .then((res) => {
        const fee = Number(res.data?.delivery_fee);
        if (Number.isFinite(fee)) setDeliveryFee(fee);
      })
      .catch(() => {});
  }, []);

  const getImgSrc = (img) => {
    if (!img) return FALLBACK_IMG;

    if (
      typeof img === "string" &&
      (img.startsWith("http") || img.startsWith("blob:") || img.startsWith("data:"))
    ) {
      return img;
    }

    return `${API_URL}/images/${img}`;
  };

  const handleCustomerChange = (e) => {
    setCustomer((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + toNumber(item.price) * (item.quantity || 1), 0);
  }, [cart]);

  const total = subtotal + deliveryFee;

  const itemCount = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  }, [cart]);

  const decQty = (item) => {
    const current = item.quantity || 1;
    if (current <= 1) return;
    updateQuantity(item.id, current - 1);
  };

  const incQty = (item) => {
    const current = item.quantity || 1;

    // ✅ ADDED: do not allow quantity more than stock
    const stock = Number(item.stock_quantity) || 0;

    if (current >= stock) {
      setErrorMsg(`Only ${stock} item(s) available for ${item.name}`);
      return;
    }

    updateQuantity(item.id, current + 1);
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (loading) return;

    if (!token) {
      goToLogin();
      return;
    }

    if (cart.length === 0) {
      setErrorMsg("Cart is empty");
      return;
    }

    // ✅ ADDED: check cart quantity before checkout
    for (const item of cart) {
      const stock = Number(item.stock_quantity) || 0;
      const qty = Number(item.quantity) || 1;

      if (stock <= 0) {
        setErrorMsg(`${item.name} is sold out. Please remove it from cart.`);
        return;
      }

      if (qty > stock) {
        setErrorMsg(`Only ${stock} item(s) available for ${item.name}`);
        return;
      }
    }

    if (
      !customer.customer_name.trim() ||
      !customer.customer_phone.trim() ||
      !customer.customer_address.trim()
    ) {
      setErrorMsg("Please fill name, phone, and address.");
      return;
    }

    const items = cart.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      qty: Number(item.quantity) || 1,
    }));

    const orderData = {
      customer_name: customer.customer_name.trim(),
      customer_phone: customer.customer_phone.trim(),
      customer_address: customer.customer_address.trim(),
      payment_method: paymentMethod,
      save_details: saveDetails,
      items,
    };

    try {
      setLoading(true);

      const res = await axios.post(`${API_URL}/orders`, orderData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      clearCart();
      // My Orders shows the confirmation banner
      navigate("/my-orders", { state: { placedOrderId: res.data.order_id } });
    } catch (err) {
      console.error("Checkout error:", err);

      // Session expired: sign in again, then come back here (the cart is kept)
      if (err?.response?.status === 401 || err?.response?.status === 403) {
        clearUserSession();
        goToLogin();
        return;
      }

      setErrorMsg(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Checkout failed"
      );
    } finally {
      setLoading(false);
    }
  };

  const stockNote = (stock) => {
    if (stock <= 0) return <span className="stock-note stock-note--out">Sold out</span>;
    if (isLowStock(stock)) return <span className="stock-note stock-note--low">Only {stock} left</span>;
    return <span className="stock-note stock-note--ok">In stock</span>;
  };

  const suggestionRow = (title, lead) =>
    suggestions.length > 0 && (
      <div className="mt-scope cart-popular">
        <div className="mt-section-head">
          <div>
            <h2>{title}</h2>
            <p>{lead}</p>
          </div>
        </div>
        <ProductsItem products={suggestions} row showToolbar={false} showCategories={false} showPagination={false} />
      </div>
    );

  if (cart.length === 0) {
    return (
      <section className="cart-page hp-wide">
        <div className="cart-layout">
          <div className="cart-empty">
            <div className="cart-empty__icon">
              <ShoppingCartOutlinedIcon fontSize="inherit" />
            </div>
            <div className="cart-empty__text">
              <h1>Your cart is empty</h1>
              <p>Browse our products and add the items you like. They'll show up here.</p>
            </div>
            <div className="cart-empty__actions">
              <button type="button" className="cart-btn cart-btn--primary" onClick={() => navigate("/shop")}>
                Start shopping
              </button>
              {wishlist.length > 0 && (
                <Link to="/wishlist" className="mt-btn mt-btn--secondary">
                  <FavoriteBorderIcon fontSize="small" /> Your wishlist ({wishlist.length})
                </Link>
              )}
            </div>
          </div>

          {suggestionRow("Popular right now", "What other MegaTech customers are buying.")}
        </div>
      </section>
    );
  }

  return (
    <section className="cart-page hp-wide">
      <div className="cart-layout">
        <header className="cart-head">
          <h1>
            Shopping Cart <span>({itemCount} {itemCount === 1 ? "item" : "items"})</span>
          </h1>
          <button type="button" className="cart-back" onClick={() => navigate("/shop")}>
            <ArrowBackIcon fontSize="small" /> Continue shopping
          </button>
        </header>

        {errorMsg && (
          <div className="cart-alert" role="alert">
            {errorMsg}
          </div>
        )}

        <div className="cart-grid">
          <div className="cart-main">
            {/* ===== Items ===== */}
            <div className="cart-box">
              <div className="cart-cols" aria-hidden="true">
                <span>Product</span>
                <span>Quantity</span>
                <span>Total</span>
              </div>

              <ul className="cart-list">
                {cart.map((item) => {
                  const stock = Number(item.stock_quantity) || 0;
                  const qty = item.quantity || 1;
                  const unit = toNumber(item.price);

                  return (
                    <li className="cart-row" key={item.id}>
                      <Link to={productPath(item)} className="cart-row__media">
                        <img
                          src={getImgSrc(item.image)}
                          alt={item.name}
                          className="cart-row__img"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = FALLBACK_IMG;
                          }}
                        />
                      </Link>

                      <div className="cart-row__info">
                        {item.category_name && <span className="cart-row__cat">{item.category_name}</span>}
                        <h3>
                          <Link to={productPath(item)}>{item.name}</Link>
                        </h3>
                        {stockNote(stock)}
                        <div className="cart-row__links">
                          <button type="button" onClick={() => saveForLater(item)}>
                            <FavoriteBorderIcon fontSize="small" /> Save for later
                          </button>
                          <button
                            type="button"
                            className="cart-row__remove"
                            onClick={() => removeFromCart(item.id)}
                            aria-label={`Remove ${item.name}`}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>

                      <div className="cart-qty" aria-label={`Quantity for ${item.name}`}>
                        <button
                          type="button"
                          onClick={() => decQty(item)}
                          disabled={qty <= 1}
                          aria-label="Decrease quantity"
                        >
                          <RemoveIcon fontSize="small" />
                        </button>
                        <span>{qty}</span>
                        <button
                          type="button"
                          onClick={() => incQty(item)}
                          disabled={qty >= stock}
                          aria-label="Increase quantity"
                        >
                          <AddIcon fontSize="small" />
                        </button>
                      </div>

                      <div className="cart-row__price">
                        <strong className="cart-row__total">{formatMoney(unit * qty)}</strong>
                        {qty > 1 && <span className="cart-row__unit">{formatMoney(unit)} each</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* ===== Delivery + payment (signed in): a wide section under the items ===== */}
            {token && (
              <form id="checkout-form" className="cart-box cart-checkout" onSubmit={handleCheckout} noValidate>
                <h2>
                  <span className="cart-step">1</span> Delivery details
                </h2>

                <div className="cart-fields">
                  <label className="cart-field">
                    <span>Full name</span>
                    <input
                      name="customer_name"
                      autoComplete="name"
                      value={customer.customer_name}
                      onChange={handleCustomerChange}
                      placeholder="e.g. Ahmad Khalil"
                    />
                  </label>

                  <label className="cart-field">
                    <span>Phone number</span>
                    <input
                      name="customer_phone"
                      type="tel"
                      autoComplete="tel"
                      value={customer.customer_phone}
                      onChange={handleCustomerChange}
                      placeholder="e.g. 70 123 456"
                    />
                  </label>

                  <label className="cart-field cart-field--wide">
                    <span>Delivery address</span>
                    <textarea
                      name="customer_address"
                      rows={2}
                      autoComplete="street-address"
                      value={customer.customer_address}
                      onChange={handleCustomerChange}
                      placeholder="City, street, building, floor"
                    />
                  </label>
                </div>

                <label className="cart-save">
                  <input type="checkbox" checked={saveDetails} onChange={(e) => setSaveDetails(e.target.checked)} />
                  <span>Save these details for next time</span>
                </label>

                <h2 className="cart-checkout__gap">
                  <span className="cart-step">2</span> Payment
                </h2>
                <div className="cart-pay" role="radiogroup" aria-label="Payment method">
                  {Object.entries(PAYMENT_METHODS).map(([id, method]) => {
                    const Icon = PAYMENT_ICONS[id];
                    return (
                      <label key={id} className={`cart-pay__option ${paymentMethod === id ? "is-selected" : ""}`}>
                        <input
                          type="radio"
                          name="payment_method"
                          value={id}
                          checked={paymentMethod === id}
                          onChange={() => setPaymentMethod(id)}
                        />
                        <Icon fontSize="small" />
                        <span>
                          <strong>{method.label}</strong>
                          <small>{method.hint}</small>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <p className="cart-delivery-note">
                  <LocalShippingOutlinedIcon fontSize="small" />
                  <span>
                    Beirut orders arrive faster; other areas take a little longer.{" "}
                    <Link to="/shipping">Delivery info</Link>
                  </span>
                </p>
              </form>
            )}
          </div>

          {/* ===== Summary ===== */}
          <aside className="cart-summary">
            <h2>Order Summary</h2>

            <div className="cart-summary__line">
              <span>
                Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
              </span>
              <span>{formatMoney(subtotal)}</span>
            </div>

            <div className="cart-summary__line">
              <span>Delivery</span>
              <span>{deliveryFee ? formatMoney(deliveryFee) : "Free"}</span>
            </div>

            <div className="cart-summary__line cart-summary__line--total">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>

            {!token ? (
              <div className="cart-signin">
                <button type="button" className="cart-btn cart-btn--primary" onClick={() => goToLogin()}>
                  <LockOutlinedIcon fontSize="small" /> Sign in to checkout
                </button>
                <button type="button" className="cart-btn cart-btn--ghost" onClick={() => goToLogin("register")}>
                  Create an account
                </button>
                <p>You'll need an account to place your order and track it.</p>
              </div>
            ) : (
              <div className="cart-signin">
                <button type="submit" form="checkout-form" className="cart-btn cart-btn--primary" disabled={loading}>
                  <LockOutlinedIcon fontSize="small" /> {loading ? "Placing order..." : "Place order"}
                </button>
                {user?.email && (
                  <p className="cart-form__note">
                    Confirmation goes to <strong>{user.email}</strong>
                  </p>
                )}
              </div>
            )}

            <ul className="cart-trust">
              <li>
                <VerifiedUserOutlinedIcon fontSize="small" /> Secure checkout
              </li>
              <li>
                <PaymentsOutlinedIcon fontSize="small" /> Cash on delivery
              </li>
              <li>
                <AssignmentReturnOutlinedIcon fontSize="small" /> <Link to="/returns">7-day returns</Link>
              </li>
              <li>
                <LocalShippingOutlinedIcon fontSize="small" /> All over Lebanon
              </li>
            </ul>
          </aside>
        </div>

        {suggestionRow("You may also like", "More gear that goes well with what's in your cart.")}
      </div>
    </section>
  );
};

export default Cart;
