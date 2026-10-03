import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// NOTE: StrictMode intentionally removed.
// It double-fires effects in dev, creating duplicate WebSocket connections,
// AudioContext instances, and Gemini Live sessions that fight for resources.
createRoot(document.getElementById('root')!).render(
  <App />,
);
