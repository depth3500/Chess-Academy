import { createRoot } from 'react-dom/client';
import App from './App';
import '@fontsource-variable/plus-jakarta-sans';
import './styles.css';
import { apply } from './lib/settings';

apply();

createRoot(document.getElementById('root')!).render(<App />);
