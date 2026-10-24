import { jwtDecode } from "jwt-decode";

/*
  The customer's sign-in, in one place.
  - "Keep me signed in" ticked: saved in localStorage (stays after closing the browser, 30 days)
  - not ticked: saved in sessionStorage (gone when the tab closes)
  An expired sign-in is removed automatically.
*/
const TOKEN_KEY = "userToken";
const USER_KEY = "user";

const stores = () => {
  const list = [];
  try {
    list.push(window.localStorage);
  } catch {}
  try {
    list.push(window.sessionStorage);
  } catch {}
  return list;
};

const isExpired = (token) => {
  try {
    const { exp } = jwtDecode(token);
    return !exp || exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

export const clearUserSession = () => {
  stores().forEach((s) => {
    try {
      s.removeItem(TOKEN_KEY);
      s.removeItem(USER_KEY);
    } catch {}
  });
};

export const saveUserSession = ({ token, user }, remember) => {
  clearUserSession();
  const store = remember ? window.localStorage : window.sessionStorage;
  try {
    store.setItem(TOKEN_KEY, token);
    store.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
};

// The store that currently holds a valid sign-in (or null)
const activeStore = () => {
  for (const s of stores()) {
    let token = null;
    try {
      token = s.getItem(TOKEN_KEY);
    } catch {}
    if (!token) continue;
    if (isExpired(token)) {
      clearUserSession();
      return null;
    }
    return s;
  }
  return null;
};

export const getUserToken = () => activeStore()?.getItem(TOKEN_KEY) || null;

export const getUser = () => {
  const store = activeStore();
  if (!store) return null;
  try {
    return JSON.parse(store.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
};
