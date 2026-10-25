import React, { useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCartOutlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import AssignmentReturnOutlinedIcon from "@mui/icons-material/AssignmentReturnOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ProductsItem from "../Components/ProductsItem";
import WishlistButton from "../Components/WishlistButton";
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
  productIdFromParam,
  productPath,
  toCartProduct,
  FALLBACK_IMG,
} from "../utils/shop";
import "../Styles/theme.css";
import "../Styles/HomePage.css";
import "../Styles/Shop.css";
import "../Styles/Product.css";

// "Memory: 24 GB" -> { name: "Memory", value: "24 GB" }; lines without ":" become notes
const parseSpecs = (text) =>
  String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf(":");
      return at > 0
        ? { name: line.slice(0, at).trim(), value: line.slice(at + 1).trim() }
        : { name: "", value: line };
    });

// How many specs show before "See all"
const KEY_SPECS = 6;

const Product = () => {
  const { id: param } = useParams();
  const productId = productIdFromParam(param); // "12-nvidia-rtx-4090" -> 12
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { addToCart } = useContext(CartContext);

  const [product, setProduct] = useState(null);
  const [related, setRelated] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | missing | error
  const [qty, setQty] = useState(1);
  const [photo, setPhoto] = useState(0); // which photo is shown large
  const [allSpecs, setAllSpecs] = useState(false);
  const actionsRef = useRef(null);
  const [showBuyBar, setShowBuyBar] = useState(false); // phones: price + buttons pinned to the bottom

  useEffect(() => {
    let alive = true;
    setStatus("loading");
    setQty(1);
    setPhoto(0);
    setAllSpecs(false);

    if (!productId) {
      setStatus("missing");
      return undefined;
    }

    api
      .get(`/products/${productId}`)
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
  }, [productId]);

  // Phones: once the Add to cart buttons scroll out of view, a bar with them stays at the bottom
  useEffect(() => {
    const el = actionsRef.current;
    if (status !== "ready" || !el || !window.IntersectionObserver) return undefined;
    const observer = new IntersectionObserver(([entry]) =>
      setShowBuyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      setShowBuyBar(false);
    };
  }, [status, productId]);

  useEffect(() => {
    document.body.classList.toggle("has-buybar", showBuyBar);
    return () => document.body.classList.remove("has-buybar");
  }, [showBuyBar]);

  // Old or short links (/product/12) get the current name added: /product/12-nvidia-rtx-4090
  useEffect(() => {
    if (status !== "ready" || !product) return;
    const canonical = productPath(product);
    if (pathname !== canonical) navigate(canonical, { replace: true });
  }, [status, product, pathname, navigate]);

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

  // main photo first, then the extra ones
  const photos = [product.image, ...(product.images || []).map((g) => g.image)].filter(Boolean);
  const shown = photos[Math.min(photo, photos.length - 1)];
  const step = (dir) => setPhoto((i) => (i + dir + photos.length) % photos.length);
  const specs = parseSpecs(product.specs);
  const shownSpecs = allSpecs ? specs : specs.slice(0, KEY_SPECS);

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
          {/* ===== Photos ===== */}
          <div className="pd-gallery">
            <div
              className="pd-media"
              tabIndex={photos.length > 1 ? 0 : undefined}
              onKeyDown={(e) => {
                if (photos.length < 2) return;
                if (e.key === "ArrowRight") step(1);
                if (e.key === "ArrowLeft") step(-1);
              }}
              aria-label={photos.length > 1 ? `Photo ${photo + 1} of ${photos.length}` : undefined}
            >
              {label && (
                <span
                  className={`pc-label ${
                    isBestSeller(product) ? "pc-label--best" : /^new/i.test(label) ? "pc-label--new" : ""
                  }`}
                >
                  {isBestSeller(product) ? "Best Seller" : label}
                </span>
              )}
              <img key={shown} src={imageUrl(shown) || FALLBACK_IMG} alt={product.name} onError={onImageError} />

              {photos.length > 1 && (
                <>
                  <button type="button" className="pd-arrow pd-arrow--prev" onClick={() => step(-1)} aria-label="Previous photo">
                    <ChevronLeftIcon />
                  </button>
                  <button type="button" className="pd-arrow pd-arrow--next" onClick={() => step(1)} aria-label="Next photo">
                    <ChevronRightIcon />
                  </button>
                  <span className="pd-count">
                    {photo + 1} / {photos.length}
                  </span>
                </>
              )}
            </div>

            {photos.length > 1 && (
              <div className="pd-thumbs" role="tablist" aria-label="Product photos">
                {photos.map((img, i) => (
                  <button
                    key={`${img}-${i}`}
                    type="button"
                    role="tab"
                    aria-selected={i === photo}
                    aria-label={`Show photo ${i + 1}`}
                    className={i === photo ? "is-active" : ""}
                    onClick={() => setPhoto(i)}
                  >
                    <img src={imageUrl(img)} alt="" loading="lazy" onError={onImageError} />
                  </button>
                ))}
              </div>
            )}
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

            {specs.length > 0 && (
              <div className="pd-keyspecs">
                <h2>{allSpecs || specs.length <= KEY_SPECS ? "Specifications" : "Key specs"}</h2>
                <table>
                  <tbody>
                    {shownSpecs.map((row, i) =>
                      row.name ? (
                        <tr key={i}>
                          <th scope="row">{row.name}</th>
                          <td>{row.value}</td>
                        </tr>
                      ) : (
                        <tr key={i}>
                          <td colSpan={2}>{row.value}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
                {specs.length > KEY_SPECS && (
                  <button type="button" className="pd-keyspecs__more" onClick={() => setAllSpecs((v) => !v)}>
                    {allSpecs ? "Show fewer" : `See all ${specs.length} specifications`}
                  </button>
                )}
              </div>
            )}

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

            <div className="pd-actions" ref={actionsRef}>
              <button type="button" className="mt-btn mt-btn--secondary" onClick={handleAdd} disabled={soldOut}>
                <AddShoppingCartIcon /> Add to cart
              </button>
              <button type="button" className="mt-btn mt-btn--primary" onClick={handleBuy} disabled={soldOut}>
                Buy now
              </button>
            </div>
            <WishlistButton product={product} withLabel className="pd-wish" />

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
                  <strong>Cash on delivery</strong>
                  Pay when your order arrives.
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
              limit={8}
              row
              showToolbar={false}
              showCategories={false}
              showPagination={false}
            />
          </section>
        )}
      </div>

      {!soldOut && (
        <div className={`pd-buybar ${showBuyBar ? "is-shown" : ""}`} aria-hidden={!showBuyBar}>
          <div className="pd-buybar__info">
            <strong>{product.name}</strong>
            <span>{formatMoney(product.price)}</span>
          </div>
          <button type="button" className="mt-btn mt-btn--secondary" onClick={handleAdd} tabIndex={showBuyBar ? 0 : -1} aria-label="Add to cart">
            <AddShoppingCartIcon />
          </button>
          <button type="button" className="mt-btn mt-btn--primary" onClick={handleBuy} tabIndex={showBuyBar ? 0 : -1}>
            Buy now
          </button>
        </div>
      )}
    </div>
  );
};

export default Product;
