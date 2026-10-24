import React, { useContext, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCartOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ProductsItem from "../Components/ProductsItem";
import { CartContext } from "../Context/CartContext";
import api from "../api";
import {
  formatMoney,
  imageUrl,
  isBestSeller,
  isLowStock,
  isSoldOut,
  normalizeLabel,
  onImageError,
  toCartProduct,
  FALLBACK_IMG,
} from "../utils/shop";
import "../Styles/theme.css";
import "../Styles/HomePage.css";
import "../Styles/Shop.css";
import "../Styles/Product.css";

const Product = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useContext(CartContext);

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | missing | error
  const [qty, setQty] = useState(1);

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    setQty(1);

    api
      .get(`/products/${id}`)
      .then((res) => {
        if (!alive) return;
        setProduct(res.data);
        setStatus("ready");
        document.title = `${res.data.name} | MegaTech`;
      })
      .catch((err) => {
        if (alive) setStatus(err.response?.status === 404 ? "missing" : "error");
      });

    // other products from the same shop, for "You may also like"
    api
      .get("/products")
      .then((res) => alive && setRelated(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});

    return () => {
      alive = false;
      document.title = "MegaTech | PC Components & Gaming Gear";
    };
  }, [id]);

  if (status === "loading") {
    return (
      <div className="mt-page hp">
        <div className="mt-container">
          <div className="pd">
            <div className="mt-skeleton pd-skeleton" />
            <div className="mt-skeleton pd-skeleton" />
          </div>
        </div>
      </div>
    );
  }

  if (status !== "ready") {
    return (
      <div className="mt-page hp">
        <div className="mt-container">
          <div className="mt-panel mt-empty pd-missing">
            <div className="mt-empty__icon">
              <Inventory2OutlinedIcon fontSize="inherit" />
            </div>
            <h3>{status === "missing" ? "This product isn't available" : "We couldn't load this product"}</h3>
            <p>
              {status === "missing"
                ? "It may have been removed. Have a look at the rest of the shop."
                : "Please check your connection and try again."}
            </p>
            <Link to="/shop" className="mt-btn mt-btn--primary">
              Back to the shop
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const stock = Number(product.stock_quantity) || 0;
  const soldOut = isSoldOut(product);
  const label = normalizeLabel(product.label);
  const categoryLink = `/shop?category=${encodeURIComponent(product.category_name)}`;

  const changeQty = (next) => setQty(Math.min(Math.max(1, next), Math.max(1, stock)));

  const handleAdd = () => addToCart(toCartProduct(product), { quantity: qty });
  const handleBuy = () => {
    if (addToCart(toCartProduct(product), { quantity: qty, silent: true })) navigate("/cart");
  };

  const sameCategory = (p) => p.id !== product.id && p.category_name === product.category_name;

  return (
    <div className="mt-page hp">
      <div className="mt-container">
        <nav className="sh-crumbs" aria-label="Breadcrumb">
          <Link to="/home">Home</Link>
          <ChevronRightIcon fontSize="inherit" />
          <Link to="/shop">Shop</Link>
          <ChevronRightIcon fontSize="inherit" />
          <Link to={categoryLink}>{product.category_name}</Link>
          <ChevronRightIcon fontSize="inherit" />
          <span aria-current="page">{product.name}</span>
        </nav>

        <div className="pd">
          {/* ===== Photo ===== */}
          <div className="pd-media">
            {label && (
              <span
                className={`pc-label ${
                  isBestSeller(product) ? "pc-label--best" : /^new/i.test(label) ? "pc-label--new" : ""
                }`}
              >
                {isBestSeller(product) ? "Best Seller" : label}
              </span>
            )}
            <img src={imageUrl(product.image) || FALLBACK_IMG} alt={product.name} onError={onImageError} />
          </div>

          {/* ===== Details ===== */}
          <div className="pd-info">
            <Link to={categoryLink} className="pd-cat">
              {product.category_name}
            </Link>
            <h1 className="pd-title">{product.name}</h1>

            <div className="pd-price-row">
              <span className="pd-price">{formatMoney(product.price)}</span>
              {soldOut ? (
                <span className="pc-stock pc-stock--out">Out of stock</span>
              ) : isLowStock(stock) ? (
                <span className="pc-stock pc-stock--low">Only {stock} left</span>
              ) : (
                <span className="pc-stock pc-stock--in">In stock</span>
              )}
            </div>

            {product.description && <p className="pd-desc">{product.description}</p>}

            {!soldOut && (
              <div className="pd-qty-row">
                <span className="pd-qty-label">Quantity</span>
                <div className="pd-qty" aria-label="Quantity">
                  <button type="button" onClick={() => changeQty(qty - 1)} disabled={qty <= 1} aria-label="Decrease quantity">
                    <RemoveIcon fontSize="small" />
                  </button>
                  <span aria-live="polite">{qty}</span>
                  <button
                    type="button"
                    onClick={() => changeQty(qty + 1)}
                    disabled={qty >= stock}
                    aria-label="Increase quantity"
                  >
                    <AddIcon fontSize="small" />
                  </button>
                </div>
              </div>
            )}

            <div className="pd-actions">
              <button type="button" className="mt-btn mt-btn--secondary" onClick={handleAdd} disabled={soldOut}>
                <AddShoppingCartIcon /> Add to cart
              </button>
              <button type="button" className="mt-btn mt-btn--primary" onClick={handleBuy} disabled={soldOut}>
                Buy now
              </button>
            </div>

            <ul className="pd-perks">
              <li>
                <LocalShippingOutlinedIcon fontSize="small" />
                <span>
                  <strong>Delivery all over Lebanon</strong>
                  Faster in Beirut. <Link to="/shipping">Delivery info</Link>
                </span>
              </li>
              <li>
                <PaymentsOutlinedIcon fontSize="small" />
                <span>
                  <strong>Pay on delivery</strong>
                  Cash or Visa card when your order arrives.
                </span>
              </li>
              <li>
                <AssignmentReturnOutlinedIcon fontSize="small" />
                <span>
                  <strong>7-day returns</strong>
                  <Link to="/returns">How returns work</Link>
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* ===== Related ===== */}
        {related.some(sameCategory) && (
          <section className="mt-section">
            <div className="mt-section-head">
              <div>
                <h2>You may also like</h2>
                <p>More {String(product.category_name).toLowerCase()} from MegaTech.</p>
              </div>
              <Link to={categoryLink} className="mt-link">
                See all
              </Link>
            </div>
            <ProductsItem
              products={related}
              filter={sameCategory}
              limit={4}
              showToolbar={false}
              showCategories={false}
              showPagination={false}
            />
          </section>
        )}
      </div>
    </div>
  );
};

export default Product;
