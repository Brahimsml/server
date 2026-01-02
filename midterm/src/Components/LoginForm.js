import { useState } from "react";
import { useAuth } from "./AuthContext";
import "../Styles/LoginForm.css";


function LoginForm(){
    const [username, setUsername]= useState("");
    const [password, setPassword]= useState("");
    const {login}= useAuth();

    const handleSubmit =(e)=> {
        e.preventDefault();
        if(login(username,password)) {
            alert("login successful!");
        }else{
            alert("Invalid credentials!");
        }

    };
    return (
     <form onSubmit={handleSubmit}>
      <h2>Login</h2>
      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <br />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br />
      <button type="submit">Login</button>
    </form>
  );
}

export default LoginForm;