import React from "react";
import { Link, useLocation } from "react-router-dom";
import { getUser, openSignIn } from "../utils/auth";

/*
  A "Sign in" / "Create account" link that opens the sign-in popup and keeps the customer on
  the page (or takes them to `redirect` afterwards). Opened in a new tab (or with JavaScript
  off) it's a normal link to the Sign in page, which comes back afterwards.
*/
const SignInLink = ({ mode = "login", context = null, redirect = null, onClick, ...rest }) => {
  const { pathname, search } = useLocation();
  const query = new URLSearchParams({ redirect: redirect || pathname + search, ...(mode === "register" ? { mode } : {}) });

  return (
    <Link
      to={`/login?${query}`}
      {...rest}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        openSignIn({ mode, context, redirect });
      }}
    />
  );
};

// A link to a page that needs an account (My orders, My account): signed out, it opens
// the sign-in popup first and then goes there
export const AccountLink = ({ to, ...rest }) => (getUser() ? <Link to={to} {...rest} /> : <SignInLink redirect={to} {...rest} />);

export default SignInLink;
