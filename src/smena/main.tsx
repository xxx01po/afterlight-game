import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/smena.css';

// Block browser gestures that fight with game controls (pinch zoom, double-tap zoom, long-press menu).
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => {
  // allow scrolling only inside scrollable panels
  const t = e.target as HTMLElement;
  if (!t.closest('.panel, .paper')) e.preventDefault();
}, { passive: false });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
