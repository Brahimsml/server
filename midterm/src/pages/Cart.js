import React, { useContext, useMemo, useState } from "react";
import axios from "axios";
import { CartContext } from "../Context/CartContext";
import "../Styles/card.css";

const Cart = () => {
  const ctx = useContext(CartContext);
  const { cart, removeFromCart, updateQuantity } = ctx;
  const clearCart = ctx.clearCart || (() => {});

  //  Checkout form state
  const [customer, setCustomer] = useState({
    customer_name: "",
    customer_phone: "",
    customer_address: "",
  });

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  
  const getImgSrc = (img) => {
    if (!img) return "";

    if (
      typeof img === "string" &&
      (img.startsWith("http") ||
        img.startsWith("blob:") ||
        img.startsWith("data:"))
    ) {
      return img; // already valid
    }

    // DB filename
    if (typeof img === "string") {
      return `http://localhost:5000/images/${img}`;
    }

    return "";
  };

  const handleCustomerChange = (e) => {
    setCustomer((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  //  Total calculation
  const total = useMemo(() => {
    return cart.reduce((sum, item) => {
      const priceNum = Number(String(item.price).replace(/[$,]/g, "")) || 0;
      const qty = item.quantity || 1;
      return sum + priceNum * qty;
    }, 0);
  }, [cart]);

  const decQty = (item) => {
    const current = item.quantity || 1;
    if (current <= 1) return;
    updateQuantity(item.id, current - 1);
  };

  const incQty = (item) => {
    const current = item.quantity || 1;
    updateQuantity(item.id, current + 1);
  };

  //  Checkout
  const handleCheckout = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    if (loading) return;

    if (cart.length === 0) {
      setErrorMsg("Cart is empty");
      return;
    }

    if (
      !customer.customer_name.trim() ||
      !customer.customer_phone.trim() ||
      !customer.customer_address.trim()
    ) {
      setErrorMsg("Please fill name, phone and address.");
      return;
    }

    try {
      setLoading(true);

      const items = cart.map((item) => ({
        id: item.id,
        name: item.name,
        price: item.price,
        qty: Number(item.quantity) || 1,
      }));

      const res = await axios.post("https://server-2plo.onrender.com/orders", {
        customer_name: customer.customer_name.trim(),
        customer_phone: customer.customer_phone.trim(),
        customer_address: customer.customer_address.trim(),
        items,
      });

      setSuccessMsg(`Order placed successfully ✅ (ID: ${res.data.order_id})`);

      clearCart();

      setCustomer({
        customer_name: "",
        customer_phone: "",
        customer_address: "",
      });
    } catch (err) {
      console.error("❌ CHECKOUT ERROR:", err);
      console.error("❌ SERVER RESPONSE:", err?.response?.data);

      setErrorMsg(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          "Checkout failed (frontend error)"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="cart">
  <div className="cart-container">
    <h1>Shopping Cart</h1>

    {successMsg && <div className="msg success">{successMsg}</div>}
    {errorMsg && <div className="msg error">{errorMsg}</div>}

    {cart.length === 0 ? (
      <p className="cart-empty">Your cart is empty.</p>
    ) : (
      <>
        <div className="cart-items">
          {cart.map((item) => (
            <div className="cart-item" key={item.id}>
              <img
                src={getImgSrc(item.image)}
                alt={item.name}
                className="cart-img"
                onError={(e) =>
                  (e.currentTarget.src =
                    "https://via.placeholder.com/300x200?text=No+Image")
                }
              />

              <div className="cart-info">
                <h3>{item.name}</h3>
                <p className="price-text">${item.price}</p>

                <div className="quantity-box">
                  <button onClick={() => decQty(item)}>-</button>
                  <span>{item.quantity || 1}</span>
                  <button onClick={() => incQty(item)}>+</button>
                </div>
              </div>

              <button className="remove-btn" onClick={() => removeFromCart(item.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          Total: <strong>${total.toFixed(2)}</strong>
        </div>

        <div className="checkout-box">
          <h3>Checkout Details</h3>

          <input name="customer_name" value={customer.customer_name} onChange={handleCustomerChange} placeholder="Full Name" />
          <input name="customer_phone" value={customer.customer_phone} onChange={handleCustomerChange} placeholder="Phone" />
          <input name="customer_address" value={customer.customer_address} onChange={handleCustomerChange} placeholder="Delivery Address" />

          <button onClick={handleCheckout} disabled={loading}>
            {loading ? "Placing order..." : "Checkout"}
          </button>
        </div>
      </>
    )}
  </div>
</div>

  );
};

export default Cart;
