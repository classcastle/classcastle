// Content script for join.html - forwards messages from page to background script
// This is needed for Firefox which doesn't support externally_connectable

// API compatibility shim for Chrome and Firefox
const api = globalThis.browser ?? globalThis.chrome;

console.log('Classcastle content script loaded');
console.log('API available:', api.runtime ? 'yes' : 'no');
console.log('Browser:', typeof browser !== 'undefined' ? 'Firefox' : 'Chrome');

// Notify page that content script is ready immediately
window.postMessage({
  type: 'CLASSCASTELEXTENSION_READY'
}, '*');

console.log('Sent CLASSCASTELEXTENSION_READY message');

// Listen for messages from the page
window.addEventListener('message', (event) => {
  // Only accept messages from same origin
  if (event.source !== window) return;
  
  const message = event.data;
  if (!message || message.type !== 'CLASSCASTELEXTENSION') return;
  
  console.log('Content script received message from page:', message);
  console.log('Payload:', message.payload);
  
  // Forward to background script
  if (api && api.runtime) {
    console.log('Sending to background script...');
    api.runtime.sendMessage(message.payload, (response) => {
      console.log('Background script response:', response);
      // Send response back to page
      window.postMessage({
        type: 'CLASSCASTELEXTENSION_RESPONSE',
        id: message.id,
        response: response
      }, '*');
    });
  } else {
    console.error('Extension API not available in content script');
    // Send error response back to page
    window.postMessage({
      type: 'CLASSCASTELEXTENSION_RESPONSE',
      id: message.id,
      response: { success: false, error: 'Extension API not available' }
    }, '*');
  }
});
