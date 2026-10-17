import React from "react";
import { Link } from "react-router-dom";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import FlagOutlinedIcon from "@mui/icons-material/FlagOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import apo from "../Assets/apo.jpeg";
import "../Styles/theme.css";
import "../Styles/AboutPage.css";

const HIGHLIGHTS = [
  { icon: WorkspacePremiumOutlinedIcon, title: "Premium", text: "Carefully selected accessories and components" },
  { icon: LockOutlinedIcon, title: "Secure", text: "Protected, account-based checkout" },
  { icon: BoltOutlinedIcon, title: "Fast", text: "A simple ordering system with order tracking" },
];

const VALUES = [
  {
    icon: FlagOutlinedIcon,
    title: "Our mission",
    text: "To provide high-quality PC accessories and components that help users build better and more reliable setups.",
  },
  {
    icon: VisibilityOutlinedIcon,
    title: "Our vision",
    text: "To become a trusted destination for tech lovers looking for performance, design, and value.",
  },
  {
    icon: HandshakeOutlinedIcon,
    title: "Our promise",
    text: "A smooth shopping experience, clear product details, and a secure checkout system.",
  },
  {
    icon: Inventory2OutlinedIcon,
    title: "What we offer",
    text: "Gaming peripherals, PC accessories, hardware products, and support for customers building their ideal setup.",
  },
];

const About = () => {
  return (
    <section className="mt-page">
      <div className="mt-container">
        {/* ===== HERO ===== */}
        <div className="ab-hero">
          <div className="ab-hero__copy">
            <span className="mt-eyebrow">About MegaTech</span>
            <h1 className="mt-title ab-hero__title">Built for gamers, creators and PC builders</h1>
            <p className="mt-lead">
              MegaTech Accessories is a modern PC accessories store focused on performance, quality,
              and style. We help customers find reliable components, gaming peripherals, and
              accessories for better setups.
            </p>

            <div className="ab-hero__actions">
              <Link to="/home" className="mt-btn mt-btn--primary">
                Explore products <ArrowForwardIcon />
              </Link>
              <Link to="/contact" className="mt-btn mt-btn--secondary">
                Contact us
              </Link>
            </div>
          </div>

          <div className="ab-hero__media">
            <img src={apo} alt="A gaming setup with a monitor, keyboard and headset" />
          </div>
        </div>

        {/* ===== HIGHLIGHTS ===== */}
        <div className="ab-highlights mt-panel">
          {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
            <div className="ab-highlight" key={title}>
              <span className="ab-icon">
                <Icon />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ===== VALUES ===== */}
        <section className="mt-section">
          <div className="mt-section-head">
            <div>
              <h2>Why MegaTech?</h2>
              <p>
                We focus on a clean shopping experience with trusted products and a simple ordering
                process.
              </p>
            </div>
          </div>

          <div className="ab-values">
            {VALUES.map(({ icon: Icon, title, text }) => (
              <article className="ab-value mt-panel" key={title}>
                <span className="ab-icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ===== CTA ===== */}
        <section className="mt-cta">
          <div>
            <h2>Ready to upgrade your setup?</h2>
            <p>Browse the full catalog, or visit one of our stores.</p>
          </div>
          <div className="mt-cta__actions">
            <Link to="/home" className="mt-btn mt-btn--primary">
              Shop now
            </Link>
            <Link to="/menu" className="mt-btn mt-btn--secondary">
              Find a store
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
};

export default About;
