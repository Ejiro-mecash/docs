// widget-loader.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ChatWidget } from './components/ChatWidget';

// 1. Create a container for the widget
const widgetDiv = document.createElement('div');
widgetDiv.id = 'me-cash-docs-ai-widget';
document.body.appendChild(widgetDiv);

// 2. Mount the ChatWidget
const root = ReactDOM.createRoot(widgetDiv);
root.render(
  <React.StrictMode>
    <ChatWidget />
  </React.StrictMode>
);