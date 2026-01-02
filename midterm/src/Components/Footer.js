import React from "react";
import InstagramIcon from "@mui/icons-material/Instagram";
import TwitterIcon from "@mui/icons-material/Twitter";
import FacebookIcon from "@mui/icons-material/Facebook";
import LinkedInIcon from "@mui/icons-material/LinkedIn";
import "../Styles/Footer.css";

const Footer = () => {
  return (
    <footer className="footer">
      <div className="footer-inner">

        {/* Social Icons */}
        <div className="footer-icons">
          <InstagramIcon />
          <TwitterIcon />
          <FacebookIcon />
          <LinkedInIcon />
        </div>

        {/* Copyright */}
        <p className="footer-text">© 2025 MegaTechShop — All Rights Reserved</p>
      </div>
    </footer>
  );
};

export default Footer;
