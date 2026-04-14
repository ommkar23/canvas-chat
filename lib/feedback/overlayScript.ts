export const OVERLAY_SCRIPT = `
(function() {
  if (window.__feedbackOverlayActive) return;
  window.__feedbackOverlayActive = true;

  var style = document.createElement('style');
  style.id = '__feedback-style__';
  style.textContent = '.__fb-hover { outline: 2px solid #f97316 !important; background: rgba(249,115,22,0.08) !important; cursor: crosshair !important; }';
  document.head.appendChild(style);

  function onMouseOver(e) {
    document.querySelectorAll('.__fb-hover').forEach(function(el) { el.classList.remove('__fb-hover'); });
    e.target.classList.add('__fb-hover');
    e.stopPropagation();
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    var rect = e.target.getBoundingClientRect();
    var id = '__fb-' + Date.now();
    e.target.setAttribute('data-feedback-target-id', id);
    window.parent.postMessage({
      type: '__feedback-click__',
      targetId: id,
      rect: {
        top: e.clientY,
        left: e.clientX,
        width: rect.width,
        height: rect.height,
        bottom: e.clientY,
        right: e.clientX
      }
    }, '*');
  }

  document.addEventListener('mouseover', onMouseOver, true);
  document.addEventListener('click', onClick, true);

  window.__removeFeedbackOverlay = function() {
    document.removeEventListener('mouseover', onMouseOver, true);
    document.removeEventListener('click', onClick, true);
    var s = document.getElementById('__feedback-style__');
    if (s) s.remove();
    document.querySelectorAll('.__fb-hover').forEach(function(el) { el.classList.remove('__fb-hover'); });
    window.__feedbackOverlayActive = false;
  };
})();
`;

export const REMOVE_OVERLAY_SCRIPT = `
if (window.__removeFeedbackOverlay) window.__removeFeedbackOverlay();
`;
