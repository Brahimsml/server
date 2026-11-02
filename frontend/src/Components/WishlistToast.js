import React from "react";
import { Link } from "react-router-dom";
import FavoriteIcon from "@mui/icons-material/Favorite";
import CloseIcon from "@mui/icons-material/Close";
import { useWishlist } from "../Context/WishlistContext";
import SignInLink from "./SignInLink";

// The message that pops up after tapping a heart
const WishlistToast = () => {
  const { toast, dismissToast } = useWishlist();
  if (!toast) return null;

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
            <SignInLink context="wishlist" onClick={dismissToast}>
              Sign in
            </SignInLink>{" "}
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
