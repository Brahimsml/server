import React from "react";
import accImage from "../Assets/acc.jpg"; // main product image
import bgImage from "../Assets/about-bg.jpg"; // background image
import "../Styles/About.css";

const About = () => {
  return (
    <div className="about-container">
      {/* Text Section */}
      <div className="about-text">
        <h1>About MegaTech Accessories</h1>
        <p>
          MegaTech Accessories is dedicated to providing top-tier PC components
          and gaming accessories for enthusiasts, professionals, and gamers alike.
        </p>

        <div className="about-highlight">
          <strong>Our Mission:</strong> Empower builders with the best gear,
          ensuring performance, reliability, and cutting-edge technology in every setup.
        </div>

        <div className="about-highlight secondary">
          <strong>Our Vision:</strong> To be the go-to destination for gamers,
          content creators, and tech enthusiasts who demand excellence.
        </div>

        <div className="about-highlight">
          <strong>Our Promise:</strong> Carefully select products, provide expert
          advice, and deliver support so every PC build reaches its full potential.
        </div>

        <div className="about-highlight secondary">
          <strong>Why Choose Us?</strong> From high-performance graphics cards 
          and ultra-wide monitors to premium peripherals, we curate only the 
          best products. Your satisfaction is our priority.
        </div>
      </div>

      
      <div className="about-image">
        <img src={accImage} alt="PC Accessories" />
      </div>
    </div>
  );
};

export default About;
