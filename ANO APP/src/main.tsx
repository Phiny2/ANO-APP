import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { configureNativeShell, isNativeMobileApp } from './lib/mobile';
import './styles.css';

void configureNativeShell();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (!isNativeMobileApp() && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const serviceWorkerUrl = new URL(`${import.meta.env.BASE_URL}sw.js`, window.location.href);
    void navigator.serviceWorker.register(serviceWorkerUrl.toString());
  });
}
