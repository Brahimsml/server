import React from "react";
import { Link, useLocation } from "react-router-dom";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CloseIcon from "@mui/icons-material/Close";
import { useWishlist } from "../Context/WishlistContext";

// The message that pops up after tapping a heart
const WishlistToast = () => {
  const { toast, dismissToast } = useWishlist();
  const { pathname, search } = useLocation();
  if (!toast) return null;

  const here = encodeURIComponent(pathname + search);

  return (
    <div className="wl-toast" role="status" aria-live="polite" key={toast.key}>
      <FavoriteIcon className="wl-toast__heart" fontSize="small" />
      <p>
        <strong>Saved!</strong>{" "}
        {toast.signedIn ? (
          <>
            {toast.name} is in your wishlist.{" "}
            <Link to="/wishlist" onClick={dismissToast}>
              View
            </Link>
          </>
        ) : (
          <>
            <Link to={`/login?redirect=${here}`} onClick={dismissToast}>
              Sign in
            </Link>{" "}
            to keep your wishlist on all your devices.
          </>
        )}
      </p>
      <button type="button" onClick={dismissToast} aria-label="Close">
        <CloseIcon fontSize="small" />
      </button>
    </div>
  );
};

export default WishlistToast;
