/**
 * Thin wrapper over the analytics provider so it can be swapped without
 * touching components. Currently Plausible (no cookies, no consent banner).
 */

type EventName =
  | 'affiliate_click'
  | 'newsletter_submit'
  | 'pillar_click';

type EventProps = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: (name: string, opts?: { props?: EventProps; callback?: () => void }) => void;
  }
}

export function track(name: EventName, props?: EventProps, callback?: () => void): void {
  if (typeof window === 'undefined' || !window.plausible) {
    callback?.();
    return;
  }
  window.plausible(name, { props, callback });
}

export {};
