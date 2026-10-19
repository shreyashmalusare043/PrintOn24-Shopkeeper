import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Centralized Route Scroll-To-Top listener.
 * Automatically resets window and document scroll position to (0, 0)
 * whenever the route pathname changes (client-side routing & browser history navigation)
 * on both desktop and mobile without interfering with modals or internal overflow containers.
 */
export const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Reset window and document element scroll
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' as ScrollBehavior,
    });

    if (document.documentElement) {
      document.documentElement.scrollTop = 0;
      document.documentElement.scrollLeft = 0;
    }
    if (document.body) {
      document.body.scrollTop = 0;
      document.body.scrollLeft = 0;
    }
  }, [pathname]);

  return null;
};

export default ScrollToTop;
