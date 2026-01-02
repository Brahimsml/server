import React, { useEffect, useState } from "react";
import axios from "axios";
import PlacesItem from "../Components/PlacesItem";
import "../Styles/Menu.css";
import AAA from "../Assets/googlemaps.jpg";

const Menu = () => {
  const [places, setPlaces] = useState([]);

  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        const res = await axios.get("http://localhost:5000/places");
        setPlaces(res.data);
      } catch (err) {
        console.error("Error fetching places:", err);
      }
    };

    fetchPlaces();
  }, []);

  return (
    <div
      className="menu-page"
      style={{
        backgroundImage: `url(${AAA})`,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        minHeight: "100vh",
        paddingTop: "60px",
      }}
    >
      <div className="menu-container">
        <h1>Locations</h1>

        <div className="locations-list">
          {places.map((loc) => (
            <PlacesItem
              key={loc.id}
              image={`http://localhost:5000/images/${loc.image}`}
              name={loc.name}
              tel={loc.tel}
              address={loc.address}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Menu;
