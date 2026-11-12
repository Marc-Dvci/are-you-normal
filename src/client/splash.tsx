import '@fontsource-variable/jost';
import './styles/base.css';
import './styles/screens.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Splash } from './splash/Splash';
import { FigureDefs } from './ui/Figure';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <FigureDefs />
      <Splash />
    </StrictMode>
  );
}
