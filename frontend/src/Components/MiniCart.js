import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import CloseIcon from "@mui/icons-material/Close";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import { CartContext } from "../Context/CartContext";
import { formatMoney, imageUrl, onImageError, FALLBACK_IMG } from "../utils/shop";

const toNumber = (price) => Number(String(price).replace(/[$,]/g, "")) || 0;

/*
  Dropdown cart under the navbar cart icon (a side panel on phones).
  Opens when an item is added and stays open until the user closes it.
*/
const MiniCart = () => {
  const { cart, cartCount, removeFromCart, miniCart, closeMiniCart } = useContext(CartContext);
  const navigate = useNavigate();

  if (!miniCart.open) return null;

  const subtotal = cart.reduce((sum, it) => sum + toNumber(it.price) * (it.quantity || 1), 0);
  const lastAdded = cart.find((it) => it.id === miniCart.lastAddedId);

  // Show the item that was just added first
  const items = lastAdded ? [lastAdded, ...cart.filter((it) => it.id !== lastAdded.id)] : cart;

  const goToCart = () => {
    closeMiniCart();
    navigate("/cart");
  };

  return (
    <>
      <div className="mc-overlay" onClick={closeMiniCart} aria-hidden="true" />

      <div className="mc" role="dialog" aria-label="Shopping cart">
        <div className="mc-head">
          <h2>
            Your cart <span>({cartCount})</span>
          </h2>
          <button type="button" className="mc-close" onClick={closeMiniCart} aria-label="Close cart">
            <CloseIcon fontSize="small" />
          </button>
        </div>

        {lastAdded && (
          <div className="mc-status mc-status--ok" role="status">
            <CheckCircleIcon fontSize="small" /> Added to your cart
          </div>
        )}

        {miniCart.notice && (
          <div className="mc-status mc-status--warn" role="status">
            <InfoOutlinedIcon fontSize="small" /> {miniCart.notice}
          </div>
        )}

        {cart.length === 0 ? (
          <div className="mc-empty">
            <ShoppingCartOutlinedIcon />
            <p>Your cart is empty.</p>
            <button
              type="button"
              className="mt-btn mt-btn--secondary mt-btn--sm"
              onClick={() => {
                closeMiniCart();
                navigate("/shop");
              }}
            >
              Start shopping
            </button>
          </div>
        ) : (
          <>
            <ul className="mc-list">
              {items.map((item) => {
                const qty = item.quantity || 1;
                return (
                  <li
                    key={item.id}
                    className={item.id === miniCart.lastAddedId ? "is-new" : ""}
                  >
                    <img
                      src={imageUrl(item.image) || FALLBACK_IMG}
                      alt=""
                      onError={onImageError}
                    />
                    <div className="mc-item">
                      <strong title={item.name}>{item.name}</strong>
                      <span>
                        {qty} × {formatMoney(item.price)}
                      </span>
                    </div>
                    <div className="mc-item__right">
                      <span className="mc-item__total">
                        {formatMoney(toNumber(item.price) * qty)}
                      </span>
                      <button
                        type="button"
                        className="mc-remove"
                        onClick={() => removeFromCart(item.id)}
                        aria-label={`Remove ${item.name}`}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mc-foot">
              <div className="mc-subtotal">
                <span>Subtotal</span>
                <strong>{formatMoney(subtotal)}</strong>
              </div>
              <div className="mc-actions">
                <button type="button" className="mt-btn mt-btn--secondary" onClick={goToCart}>
                  View cart
                </button>
                <button type="button" className="mt-btn mt-btn--primary" onClick={goToCart}>
                  Checkout
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default MiniCart;
