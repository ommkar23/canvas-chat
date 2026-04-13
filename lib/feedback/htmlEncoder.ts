/**
 * Wraps an element in the iframe contentDocument with <user-feedback>.
 * The element is identified by data-feedback-target-id attribute set by the overlay script.
 */
export function wrapElementWithFeedback(
  contentDoc: Document,
  targetId: string,
  feedbackId: string,
  feedbackText: string
): boolean {
  const el = contentDoc.querySelector(`[data-feedback-target-id="${targetId}"]`);
  if (!el) return false;

  const wrapper = contentDoc.createElement('user-feedback');
  wrapper.setAttribute('data-feedback-id', feedbackId);
  wrapper.setAttribute('data-status', 'unresolved');
  wrapper.setAttribute('data-timestamp', new Date().toISOString());
  wrapper.setAttribute('class', 'user-feedback');

  const textNode = contentDoc.createTextNode(feedbackText + ' ');
  const targetDiv = contentDoc.createElement('div');
  targetDiv.setAttribute('data-feedback-target', '');

  el.removeAttribute('data-feedback-target-id');
  el.parentNode!.insertBefore(wrapper, el);
  targetDiv.appendChild(el);
  wrapper.appendChild(textNode);
  wrapper.appendChild(targetDiv);

  return true;
}

/**
 * Extract the full HTML of the iframe document.
 */
export function extractHtml(contentDoc: Document): string {
  return '<!DOCTYPE html>\n' + contentDoc.documentElement.outerHTML;
}

/**
 * Update data-status on a user-feedback element.
 */
export function setFeedbackStatus(
  contentDoc: Document,
  feedbackId: string,
  status: 'resolved' | 'unresolved'
): void {
  const el = contentDoc.querySelector(`user-feedback[data-feedback-id="${feedbackId}"]`);
  el?.setAttribute('data-status', status);
}

/**
 * Remove a user-feedback wrapper (unwrap the original element).
 */
export function removeFeedback(contentDoc: Document, feedbackId: string): void {
  const wrapper = contentDoc.querySelector(`user-feedback[data-feedback-id="${feedbackId}"]`);
  if (!wrapper) return;
  const target = wrapper.querySelector('[data-feedback-target]');
  if (target) {
    const child = target.firstElementChild;
    if (child) wrapper.parentNode?.insertBefore(child, wrapper);
  }
  wrapper.remove();
}
