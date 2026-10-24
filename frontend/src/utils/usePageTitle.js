import { useEffect } from "react";

export const SITE_TITLE = "MegaTech | PC Components & Gaming Gear";

// Browser tab title for a page, e.g. "Shop | MegaTech"; back to the default when leaving
const usePageTitle = (title) => {
  useEffect(() => {
    document.title = title ? `${title} | MegaTech` : SITE_TITLE;
    return () => {
      document.title = SITE_TITLE;
    };
  }, [title]);
};

export default usePageTitle;
