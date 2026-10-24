import React from "react";
import FavoriteIcon from "@mui/icons-material/Favorite";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import { useWishlist } from "../Context/WishlistContext";

// Heart button: save a product for later (cards and the product page)
const WishlistButton = ({ product, className = "", withLabel = false }) => {
  const { isSaved, toggle } = useWishlist();
  const saved = isSaved(product.id);

  return (
    <button
      type="button"
      className={`wl-btn ${saved ? "is-saved" : ""} ${withLabel ? "wl-btn--label" : ""} ${className}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(product);
      }}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${product.name} from your wishlist` : `Save ${product.name} to your wishlist`}
      title={saved ? "Saved to your wishlist" : "Save for later"}
    >
      {saved ? <FavoriteIcon fontSize="small" /> : <FavoriteBorderIcon fontSize="small" />}
      {withLabel && <span>{saved ? "Saved" : "Save for later"}</span>}
    </button>
  );
};

export default WishlistButton;
