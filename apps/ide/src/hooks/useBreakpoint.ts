import React from "react";

/**
 * Returns true when viewport width < 768px.
 * Updates on resize via ResizeObserver on document.documentElement.
 */
export function useBreakpoint(): { isMobile: boolean } {
  const [isMobile, setIsMobile] = React.useState<boolean>(
    () => document.documentElement.clientWidth < 768,
  );

  React.useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setIsMobile(entry.contentRect.width < 768);
      }
    });
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  return { isMobile };
}
