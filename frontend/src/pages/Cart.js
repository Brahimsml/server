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
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import "../Styles/card.css";
import { API_URL } from "../api";
import { DEFAULT_DELIVERY_FEE, PAYMENT_METHODS, isLowStock } from "../utils/shop";

const PAYMENT_ICONS = { cash: PaymentsOutlinedIcon, card: CreditCardOutlinedIcon };

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
  const ctx = useContext(CartContext);
  const { cart, removeFromCart, updateQuantity } = ctx;
  const clearCart = ctx.clearCart || (() => {});
  const navigate = useNavigate();

  // Checkout needs a signed-in user; after login they come back here to confirm
  const token = sessionStorage.getItem("userToken");
  const user = JSON.parse(sessionStorage.getItem("user") || "null");
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
        sessionStorage.removeItem("userToken");
        sessionStorage.removeItem("user");
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

  if (cart.length === 0) {
    return (
      <section className="cart-page">
        <div className="cart-empty">
          <div className="cart-empty__icon">
            <ShoppingCartOutlinedIcon fontSize="inherit" />
          </div>
          <h1>Your cart is empty</h1>
          <p>Browse our products and add the items you like. They'll show up here.</p>
          <button type="button" className="cart-btn cart-btn--primary" onClick={() => navigate("/shop")}>
            Start shopping
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="cart-page">
      <div className="cart-layout">
        <header className="cart-head">
          <button type="button" className="cart-back" onClick={() => navigate("/shop")}>
            <ArrowBackIcon fontSize="small" /> Continue shopping
          </button>
          <h1>Shopping Cart</h1>
          <p>
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
        </header>

        {errorMsg && (
          <div className="cart-alert" role="alert">
            {errorMsg}
          </div>
        )}

        <div className="cart-grid">
          {/* ===== Items ===== */}
          <ul className="cart-list">
            {cart.map((item) => {
              const stock = Number(item.stock_quantity) || 0;
              const qty = item.quantity || 1;
              const unit = toNumber(item.price);

              return (
                <li className="cart-row" key={item.id}>
                  <img
                    src={getImgSrc(item.image)}
                    alt={item.name}
                    className="cart-row__img"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = FALLBACK_IMG;
                    }}
                  />

                  <div className="cart-row__info">
                    <h3>{item.name}</h3>
                    <span className="cart-row__unit">{formatMoney(unit)} each</span>
                    {stockNote(stock)}
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

                  <strong className="cart-row__total">{formatMoney(unit * qty)}</strong>

                  <button
                    type="button"
                    className="cart-row__remove"
                    onClick={() => removeFromCart(item.id)}
                    aria-label={`Remove ${item.name}`}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                    <span>Remove</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* ===== Summary + checkout ===== */}
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
                <div className="cart-signin__title">
                  <LockOutlinedIcon fontSize="small" /> Sign in to checkout
                </div>
                <p>You need an account to place your order and track its status.</p>

                <button type="button" className="cart-btn cart-btn--primary" onClick={() => goToLogin()}>
                  Sign in to checkout
                </button>

                <button type="button" className="cart-textlink" onClick={() => goToLogin("register")}>
                  New customer? Create an account
                </button>
              </div>
            ) : (
              <form className="cart-form" onSubmit={handleCheckout} noValidate>
                <h3>Delivery details</h3>

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

                <label className="cart-field">
                  <span>Delivery address</span>
                  <textarea
                    name="customer_address"
                    rows={3}
                    autoComplete="street-address"
                    value={customer.customer_address}
                    onChange={handleCustomerChange}
                    placeholder="City, street, building, floor"
                  />
                </label>

                <h3 className="cart-form__gap">Payment</h3>
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

                <button type="submit" className="cart-btn cart-btn--primary" disabled={loading}>
                  {loading ? "Placing order..." : `Place order · ${formatMoney(total)}`}
                </button>

                {user?.email && (
                  <p className="cart-form__note">
                    A confirmation will be sent to <strong>{user.email}</strong>
                  </p>
                )}
              </form>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
};

export default Cart;
