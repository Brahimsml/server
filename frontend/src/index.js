import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import './Styles/Phone.css'; // phones: loaded last so it wins
import './Styles/ModernPreview.css'; // modern menu bar, footer, home banner and category tiles (+ the ?look=modern preview)
import reportWebVitals from './reportWebVitals';

// The modern menu bar, footer, home banner and category tiles are on for every page
document.documentElement.classList.add('mt-shell');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
