import React from "react";
import ProductsItem from "../Components/ProductsItem";
import "../Styles/Home.css";
import heroImage from "../Assets/mousepad.jpg"; // Background image

const Home = () => {
  return (
    <div
      className="home-page"
      style={{
        backgroundImage: `url(${heroImage})`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
      }}
    >
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-overlay">
          <div className="hero-content">
            <h1>Welcome to MegaTech Accessories</h1>
            <p>Top-quality PC components and gaming accessories</p>
            
          </div>
        </div>
      </section>

      {/* Product Section */}
      <section className="product-section">
        <ProductsItem />
      </section>
    </div>
  );
};

export default Home;
