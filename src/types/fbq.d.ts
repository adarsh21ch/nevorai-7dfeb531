declare global {
  interface Window {
    fbq?: ((...args: any[]) => void) & {
      queue?: any[];
      loaded?: boolean;
      version?: string;
      callMethod?: (...args: any[]) => void;
      push?: (...args: any[]) => void;
    };
    _fbq?: any;
    _fbqEventIds?: Set<string>;
    getFiredPixelEvents?: () => string[];
  }
}
export {};
