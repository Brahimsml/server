import { useState } from "react";

function CounterState(props) {
  const initial = Number(props.startValue) || 0;
  const [count, setCount] = useState(initial);

  const increment = () => setCount(count + 1);
  const decrement = () => setCount(count - 1);

  return (
    <div style={{ textAlign: "center", margin: "20px" }}>
      <h1>CountState: {count}</h1>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}

export default CounterState;
