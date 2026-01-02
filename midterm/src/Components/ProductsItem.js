import React, { useEffect, useMemo, useState, useContext } from "react";
import axios from "axios";
import { CartContext } from "../Context/CartContext";
import { useNavigate } from "react-router-dom";

const ProductsItem = () => {
  const [activeCategory, setActiveCategory] = useState("All");
  const [visibleCount, setVisibleCount] = useState(5);
  const [wishlist, setWishlist] = useState([]);
  const [products, setProducts] = useState([]);

  const { addToCart } = useContext(CartContext);
  const navigate = useNavigate();

  const BASE_URL = "https://server-2plo.onrender.com";

  //  Fetch products from DB
  useEffect(() => {
    axios
      .get(`${BASE_URL}/products`)
      .then((res) => setProducts(res.data))
      .catch((err) => console.log("Error fetching products:", err));
  }, []);

  // Build categories from DB results
  const categories = useMemo(() => {
    const map = new Map();
    products.forEach((p) => {
      const catName = p.category_name || "Other";
      if (!map.has(catName)) map.set(catName, []);
      map.get(catName).push(p);
    });

    return Array.from(map.entries()).map(([name, products]) => ({
      name,
      products,
    }));
  }, [products]);

  //  Filter products by category
  const allProducts = useMemo(() => {
    return categories
      .filter((cat) => activeCategory === "All" || cat.name === activeCategory)
      .flatMap((cat) => cat.products);
  }, [categories, activeCategory]);

  // Slice visible products
  const visibleProducts = allProducts.slice(0, visibleCount);

  const loadMore = () => setVisibleCount((prev) => prev + 7);

  // Wishlist toggle
  const toggleWishlist = (productId) => {
    setWishlist((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  //  Convert DB product to "cart product" (fix image + price format)
  const toCartProduct = (p) => ({
    ...p,
    image: p.image ? `${BASE_URL}/images/${p.image}` : "",
    price: `$${Number(p.price || 0).toFixed(2)}`,
  });

  //  Buy Now = add + go cart
  const handleBuyNow = (product) => {
    addToCart(toCartProduct(product));
    navigate("/cart");
  };

  return (
    <div className="home-page">
      {/* Category Filter */}
      <div className="category-filter">
        <button
          className={activeCategory === "All" ? "active" : ""}
          onClick={() => {
            setActiveCategory("All");
            setVisibleCount(5);
          }}
        >
          All
        </button>

        {categories.map((cat) => (
          <button
            key={cat.name}
            className={activeCategory === cat.name ? "active" : ""}
            onClick={() => {
              setActiveCategory(cat.name);
              setVisibleCount(5);
            }}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product */}
      <div className="product-grid">
        {visibleProducts.map((product) => (
          <div className="product-card" key={product.id}>
            {product.label && (
              <span className="product-label">{product.label}</span>
            )}

            {/*  Image from backend */}
            <img
              src={`${BASE_URL}/images/${product.image}`}
              alt={product.name}
            />

            <div className="overlay">
             

              <button
                className="add-cart"
                onClick={() => addToCart(toCartProduct(product))}
              >
                Add to Cart
              </button>

              <button
                className="wishlist-btn"
                onClick={() => toggleWishlist(product.id)}
                style={{
                  background: wishlist.includes(product.id) ? "red" : "#1a73e8",
                  color: "#fff",
                  border: "none",
                  padding: "5px 10px",
                  borderRadius: "20px",
                  fontSize: "0.75rem",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                }}
              >
                {wishlist.includes(product.id) ? "♥ Wishlisted" : "♡ Wishlist"}
              </button>
            </div>

            <h3>{product.name}</h3>

            {product.description && (
              <p className="description">{product.description}</p>
            )}

            <p className="price">${Number(product.price || 0).toFixed(2)}</p>

            <button className="buy-now" onClick={() => handleBuyNow(product)}>
              Buy Now
            </button>
          </div>
        ))}
      </div>

      {/* Load More  */}
      {visibleCount < allProducts.length && (
        <div style={{ textAlign: "center", marginTop: "20px" }}>
          <button
            onClick={loadMore}
            className="load-more"
            style={{
              padding: "10px 25px",
              background: "linear-gradient(135deg, #1a73e8, #155bb5)",
              border: "none",
              borderRadius: "25px",
              color: "#fff",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductsItem;
