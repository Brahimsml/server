import React, { useEffect, useRef, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import api from "../../api";
import { LOW_STOCK } from "../../utils/shop";

const SAVE_AFTER_MS = 700; // wait for the admin to stop clicking, then save once

/*
  Change stock straight from the products list: − / + or type a number.
  Saves by itself shortly after the last change.
*/
const StockStepper = ({ product, onSaved, onError }) => {
  const [value, setValue] = useState(String(Number(product.stock_quantity) || 0));
  const [state, setState] = useState("idle"); // idle | saving | saved
  const saved = useRef(Number(product.stock_quantity) || 0);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const save = (next) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (next === saved.current) return;
      setState("saving");
      try {
        await api.patch(`/products/${product.id}/stock`, { stock_quantity: next });
        saved.current = next;
        setState("saved");
        onSaved?.(next);
        setTimeout(() => setState((s) => (s === "saved" ? "idle" : s)), 1500);
      } catch (err) {
        setValue(String(saved.current));
        setState("idle");
        onError?.(err);
      }
    }, SAVE_AFTER_MS);
  };

  const change = (next) => {
    const n = Math.max(0, Math.min(100000, Math.floor(next)));
    setValue(String(n));
    save(n);
  };

  const n = Number(value);
  const level = !Number.isFinite(n) || n <= 0 ? "out" : n <= LOW_STOCK ? "low" : "ok";

  return (
    <div className={`ad-stock ad-stock--${level}`}>
      <div className="ad-stock__stepper">
        <button type="button" onClick={() => change(n - 1)} disabled={n <= 0} aria-label={`One less ${product.name}`}>
          <RemoveIcon fontSize="small" />
        </button>
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={value}
          aria-label={`Stock for ${product.name}`}
          onChange={(e) => {
            setValue(e.target.value);
            const typed = Number(e.target.value);
            if (e.target.value !== "" && Number.isInteger(typed) && typed >= 0) save(typed);
          }}
          onBlur={() => {
            if (value === "" || !Number.isInteger(Number(value)) || Number(value) < 0) setValue(String(saved.current));
          }}
        />
        <button type="button" onClick={() => change(n + 1)} aria-label={`One more ${product.name}`}>
          <AddIcon fontSize="small" />
        </button>
      </div>
      <span className="ad-stock__note" aria-live="polite">
        {state === "saving" ? "Saving…" : state === "saved" ? "Saved ✓" : level === "out" ? "Sold out" : level === "low" ? "Low" : "In stock"}
      </span>
    </div>
  );
};

export default StockStepper;
