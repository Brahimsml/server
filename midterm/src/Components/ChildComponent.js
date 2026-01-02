import { useContext } from "react";
import ThemeContext from "./ThemeContext";

function ChildComponent() {
  const theme = useContext(ThemeContext);

  return (
    <h1 style={{ textAlign: "center", margin: "20px" }}>
      Current theme: {theme}
    </h1>
  );
}

export default ChildComponent;
