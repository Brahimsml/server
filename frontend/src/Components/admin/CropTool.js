import React, { useEffect, useRef, useState } from "react";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import FitScreenOutlinedIcon from "@mui/icons-material/FitScreenOutlined";
import OpenWithIcon from "@mui/icons-material/OpenWith";
import FramedImage, { fitZoom, framePlacement } from "../FramedImage";

/*
  Crop tool, like Shopify or Instagram: the picture inside the exact shape it will have on
  the site (a banner box or a category circle). Drag it to move, use the slider to zoom, or
  pick "Whole picture" / "Fill the box". Nothing is cut from the file, so it can be redone.
    value     { zoom, x, y, fill }  (see FramedImage)
    onChange  gets only what changed, e.g. { zoom: 80 }
    moveOnly  just drag to choose the part that shows (no zoom), e.g. the phone shape of a banner
*/
const MAX_ZOOM = 300;
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

const CropTool = ({ src, aspect, shape = "rect", value, onChange, moveOnly = false }) => {
  const { zoom = 100, x = 50, y = 50, fill = "dark" } = value;
  const [ratio, setRatio] = useState(null);
  const box = useRef(null);
  const drag = useRef(null);

  // the picture's own shape, to know how far it can zoom out
  useEffect(() => {
    setRatio(null);
    if (!src) return undefined;
    const img = new Image();
    img.onload = () => setRatio(img.naturalWidth / img.naturalHeight);
    img.src = src;
    return () => {
      img.onload = null;
    };
  }, [src]);

  const minZoom = ratio ? fitZoom(ratio, aspect) : 100;
  const shown = clamp(zoom, minZoom, MAX_ZOOM);
  const spaceAround = ratio && shown < 100;

  // move by a distance in % of the box (dragging the picture right moves it right)
  const moveBy = (dxPct, dyPct, from = { x, y }) => {
    if (!ratio) return;
    const p = framePlacement(ratio, aspect, shown, from.x, from.y);
    const next = {};
    if (Math.abs(100 - p.width) > 0.5) next.x = Math.round(clamp(((p.left + dxPct) / (100 - p.width)) * 100, 0, 100));
    if (Math.abs(100 - p.height) > 0.5) next.y = Math.round(clamp(((p.top + dyPct) / (100 - p.height)) * 100, 0, 100));
    if (Object.keys(next).length) onChange(next);
  };

  const onPointerDown = (e) => {
    if (!ratio) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startY: e.clientY, from: { x, y } };
  };
  const onPointerMove = (e) => {
    if (!drag.current || !box.current) return;
    const r = box.current.getBoundingClientRect();
    moveBy(((e.clientX - drag.current.startX) / r.width) * 100, ((e.clientY - drag.current.startY) / r.height) * 100, drag.current.from);
  };
  const endDrag = () => (drag.current = null);

  // keyboard: arrows move, + / - zoom
  const onKeyDown = (e) => {
    const step = e.shiftKey ? 10 : 2;
    const keys = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (keys[e.key]) {
      e.preventDefault();
      moveBy(...keys[e.key]);
    } else if (e.key === "+" || e.key === "=" || e.key === "-") {
      e.preventDefault();
      onChange({ zoom: clamp(shown + (e.key === "-" ? -5 : 5), minZoom, MAX_ZOOM) });
    }
  };

  return (
    <div className={`ad-crop ad-crop--${shape} ${moveOnly ? "ad-crop--move" : ""}`}>
      <div
        ref={box}
        className="ad-crop__box"
        style={{ aspectRatio: String(aspect) }}
        role="slider"
        tabIndex={0}
        aria-label="Picture position: drag, or use the arrow keys. Plus and minus zoom."
        aria-valuenow={shown}
        aria-valuemin={minZoom}
        aria-valuemax={MAX_ZOOM}
        aria-valuetext={`${shown}% zoom`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
      >
        <FramedImage src={src} aspect={aspect} zoom={shown} x={x} y={y} fill={fill} loading="eager" draggable={false} />
        <span className="ad-crop__hint" aria-hidden="true">
          <OpenWithIcon fontSize="inherit" /> Drag to move
        </span>
      </div>

      {!moveOnly && (
        <div className="ad-crop__controls">
          <label className="ad-crop__zoom">
            <span>Zoom</span>
            <input
              type="range"
              min={minZoom}
              max={MAX_ZOOM}
              value={shown}
              disabled={!ratio}
              onChange={(e) => onChange({ zoom: Number(e.target.value) })}
            />
            <output>{shown}%</output>
          </label>

          <div className="ad-crop__buttons">
            <button
              type="button"
              className={`mt-btn mt-btn--sm ${ratio && shown === minZoom ? "mt-btn--primary" : "mt-btn--secondary"}`}
              disabled={!ratio}
              onClick={() => onChange({ zoom: minZoom, x: 50, y: 50 })}
            >
              <FitScreenOutlinedIcon /> Whole picture
            </button>
            <button
              type="button"
              className={`mt-btn mt-btn--sm ${shown === 100 ? "mt-btn--primary" : "mt-btn--secondary"}`}
              disabled={!ratio}
              onClick={() => onChange({ zoom: 100 })}
            >
              <ZoomOutMapIcon /> Fill the {shape === "circle" ? "circle" : "box"}
            </button>
          </div>

          {spaceAround && (
            <div className="ad-seg-field">
              <span className="ad-seg-field__label">Space around it</span>
              <div className="ad-seg" role="radiogroup" aria-label="Space around the picture">
                {[
                  { v: "dark", label: "Dark" },
                  { v: "blur", label: "Blurred picture" },
                ].map(({ v, label }) => (
                  <button key={v} type="button" role="radio" aria-checked={fill === v} className={fill === v ? "is-active" : ""} onClick={() => onChange({ fill: v })}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CropTool;
