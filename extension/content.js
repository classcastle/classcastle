// Content script for join.html - forwards messages from page to background script
// This is needed for Firefox which doesn't support externally_connectable

console.log('Classcastle content script loaded');

// Listen for messages from the page
window.addEventListener('message', (event) => {
  // Only accept messages from same origin
  if (event.source !== window) return;
  
  const message = event.data;
  if (!message || message.type !== 'CLASSCASTELEXTENSION') return;
  
  console.log('Content script received message from page:', message);
  
  // Forward to background script
  if (chrome && chrome.runtime) {
    chrome.runtime.sendMessage(message.payload, (response) => {
      console.log('Background script response:', response);
      // Send response back to page
      window.postMessage({
        type: 'CLASSCASTELEXTENSION_RESPONSE',
        id: message.id,
        response: response
      }, '*');
    });
  }
});

// Notify page that content script is ready
window.postMessage({
  type: 'CLASSCASTELEXTENSION_READY'
}, '*');
