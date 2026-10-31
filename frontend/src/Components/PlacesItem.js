import React from "react";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import DirectionsOutlinedIcon from "@mui/icons-material/DirectionsOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { onImageError } from "../utils/shop";
import { parseHours, storeStatus, groupHours, todayIndex } from "../utils/hours";

const hasCoords = (lat, lng) =>
  lat !== null && lat !== "" && lng !== null && lng !== "" &&
  Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

function PlacesItem({ image, name, tel, address, lat, lng, hours: rawHours }) {
  const coords = hasCoords(lat, lng);
  const hours = parseHours(rawHours);
  const status = storeStatus(hours);
  const today = todayIndex();

  const mapSrc = coords
    ? `https://www.google.com/maps?q=${lat},${lng}&hl=en&z=15&output=embed`
    : null;

  // Directions open in Google Maps (by coordinates, or by address if none)
  const directionsUrl = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  return (
    <article className="loc-card">
      <div className="loc-card__media">
        {image ? (
          <img src={image} alt={name} loading="lazy" onError={onImageError} />
        ) : (
          <div className="loc-card__noimg">
            <StorefrontOutlinedIcon fontSize="inherit" />
          </div>
        )}
      </div>

      <div className="loc-card__body">
        <h2>{name}</h2>

        <ul className="loc-card__details">
          {address && (
            <li>
              <PlaceOutlinedIcon fontSize="small" />
              <span>{address}</span>
            </li>
          )}
          {tel && (
            <li>
              <PhoneOutlinedIcon fontSize="small" />
              <a href={`tel:${tel}`}>{tel}</a>
            </li>
          )}
        </ul>

        {/* "Open now · Closes 8 PM", opens to show the whole week */}
        {status && (
          <details className="loc-hours">
            <summary>
              <AccessTimeIcon fontSize="small" />
              <span className={`loc-hours__status ${status.open ? (status.soon ? "is-soon" : "is-open") : "is-closed"}`}>
                {status.open ? (status.soon ? "Closing soon" : "Open now") : "Closed"}
              </span>
              {status.text && <span className="loc-hours__next">· {status.text}</span>}
              <ExpandMoreIcon className="loc-hours__chev" fontSize="small" />
            </summary>
            <ul className="loc-hours__list">
              {groupHours(hours).map((g) => (
                <li key={g.days} className={today >= g.from && today <= g.to ? "is-today" : ""}>
                  <span>{g.days}</span>
                  <span>{g.text}</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <div className="loc-card__actions">
          {directionsUrl && (
            <a
              className="mt-btn mt-btn--primary mt-btn--sm"
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <DirectionsOutlinedIcon /> Directions
            </a>
          )}
          {tel && (
            <a className="mt-btn mt-btn--secondary mt-btn--sm" href={`tel:${tel}`}>
              <PhoneOutlinedIcon /> Call
            </a>
          )}
        </div>
      </div>

      {mapSrc && (
        <div className="loc-card__map">
          <iframe
            title={`Map of ${name}`}
            src={mapSrc}
            loading="lazy"
            allowFullScreen=""
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
    </article>
  );
}

export default PlacesItem;
