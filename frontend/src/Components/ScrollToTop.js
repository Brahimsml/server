import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Start each new page at the top (React Router keeps the old scroll position otherwise)
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
};

export default ScrollToTop;
