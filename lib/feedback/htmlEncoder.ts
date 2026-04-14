import type { ElementRect, FeedbackItem } from '@/types';

function getFeedbackText(wrapper: Element): string {
  return wrapper.querySelector('[data-feedback-text]')?.textContent?.trim() ?? '';
}

function getTargetRect(wrapper: Element): ElementRect | null {
  const targetContainer = wrapper.querySelector('[data-feedback-target]');
  const target = targetContainer?.firstElementChild ?? targetContainer;
  if (!target) return null;

  const rect = target.getBoundingClientRect();
  const top = Number.parseFloat(wrapper.getAttribute('data-feedback-top') ?? '');
  const left = Number.parseFloat(wrapper.getAttribute('data-feedback-left') ?? '');
  const hasStoredPosition = Number.isFinite(top) && Number.isFinite(left);

  return {
    top: hasStoredPosition ? top : rect.top,
    left: hasStoredPosition ? left : rect.left,
    width: rect.width,
    height: rect.height,
    bottom: hasStoredPosition ? top : rect.bottom,
    right: hasStoredPosition ? left : rect.right,
  };
}

/**
 * Wraps an element in the iframe contentDocument with <user-feedback>.
 * The element is identified by data-feedback-target-id attribute set by the overlay script.
 */
export function wrapElementWithFeedback(
  contentDoc: Document,
  targetId: string,
  feedbackId: string,
  feedbackText: string,
  rect?: ElementRect | null
): boolean {
  const el = contentDoc.querySelector(`[data-feedback-target-id="${targetId}"]`);
  if (!el) return false;

  const wrapper = contentDoc.createElement('user-feedback');
  wrapper.setAttribute('data-feedback-id', feedbackId);
  wrapper.setAttribute('data-status', 'unresolved');
  wrapper.setAttribute('data-timestamp', new Date().toISOString());
  wrapper.setAttribute('class', 'user-feedback');
  if (rect) {
    wrapper.setAttribute('data-feedback-top', String(rect.top));
    wrapper.setAttribute('data-feedback-left', String(rect.left));
  }

  const textEl = contentDoc.createElement('span');
  textEl.setAttribute('data-feedback-text', '');
  textEl.hidden = true;
  textEl.textContent = feedbackText;

  const targetDiv = contentDoc.createElement('div');
  targetDiv.setAttribute('data-feedback-target', '');

  el.removeAttribute('data-feedback-target-id');
  el.parentNode?.insertBefore(wrapper, el);
  targetDiv.appendChild(el);
  wrapper.appendChild(textEl);
  wrapper.appendChild(targetDiv);

  return true;
}

export function updateFeedbackText(
  contentDoc: Document,
  feedbackId: string,
  feedbackText: string
): boolean {
  const wrapper = contentDoc.querySelector(`user-feedback[data-feedback-id="${feedbackId}"]`);
  if (!wrapper) return false;

  const targetDiv = wrapper.querySelector('[data-feedback-target]');
  if (!targetDiv) return false;

  let textEl = wrapper.querySelector('[data-feedback-text]') as HTMLSpanElement | null;
  if (!textEl) {
    textEl = contentDoc.createElement('span');
    textEl.setAttribute('data-feedback-text', '');
    textEl.hidden = true;
    wrapper.insertBefore(textEl, targetDiv);
  }

  textEl.textContent = feedbackText;
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

export function extractFeedbackItems(contentDoc: Document): FeedbackItem[] {
  return Array.from(contentDoc.querySelectorAll('user-feedback[data-feedback-id]')).map((wrapper) => ({
    id: wrapper.getAttribute('data-feedback-id') ?? '',
    text: getFeedbackText(wrapper),
    status: (wrapper.getAttribute('data-status') === 'resolved' ? 'resolved' : 'unresolved'),
    timestamp: wrapper.getAttribute('data-timestamp') ?? '',
    elementRect: getTargetRect(wrapper),
  }));
}
