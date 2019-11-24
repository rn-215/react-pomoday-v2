import { useRef, useEffect, useState } from 'react';

export const useInterval = (callback, delay) => {
  const savedCallback = useRef();
  let handler = null;
  // Remember the latest callback.
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  // Set up the interval.
  useEffect(() => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== 0) {
      handler = setInterval(tick, delay);
      return () => clearInterval(handler);
    } else {
      clearInterval(handler);
    }
  }, [delay]);
};

let cachedScripts = [];

export const useScript = (src, inline) => {
  // Keeping track of script loaded and error state
  const [state, setState] = useState({
    loaded: false,
    error: false,
  });

  useEffect(() => {
    // If cachedScripts array already includes src that means another instance ...
    // ... of this hook already loaded this script, so no need to load again.
    if (cachedScripts.includes(src)) {
      setState({
        loaded: true,
        error: false,
      });
    } else {
      cachedScripts.push(src);
      // Create script
      let script = document.createElement('script');
      if (!inline) {
        script.src = src;
        script.async = true;
      } else {
        script.innerHTML = src;
      }
      // Script event listener callbacks for load and error
      const onScriptLoad = () => {
        setState({
          loaded: true,
          error: false,
        });
      };
      const onScriptError = () => {
        // Remove from cachedScripts we can try loading again
        const index = cachedScripts.indexOf(src);
        if (index >= 0) cachedScripts.splice(index, 1);
        script.remove();
        setState({
          loaded: true,
          error: true,
        });
      };
      script.addEventListener('load', onScriptLoad);
      script.addEventListener('error', onScriptError);
      // Add script to document body
      document.body.appendChild(script);
      // Remove event listeners on cleanup
      return () => {
        script.removeEventListener('load', onScriptLoad);
        script.removeEventListener('error', onScriptError);
      };
    }
  }, [src]); // Only re-run effect if script src changes
  return [state.loaded, state.error];
};

export function useEventListener(eventName, handler, element = window) {
  // Create a ref that stores handler
  const savedHandler = useRef();
  // Update ref.current value if handler changes.
  // This allows our effect below to always get latest handler ...
  // ... without us needing to pass it in effect deps array ...
  // ... and potentially cause effect to re-run every render.
  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    // Make sure element supports addEventListener
    // On
    const isSupported = element && element.addEventListener;
    if (!isSupported) return;
    // Create event listener that calls handler function stored in ref
    const eventListener = event => savedHandler.current(event);
    // Add event listener
    element.addEventListener(eventName, eventListener);
    // Remove event listener on cleanup
    return () => {
      element.removeEventListener(eventName, eventListener);
    };
  }, [eventName, element]); // Re-run if eventName or element changes
}
