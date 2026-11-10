import { useEffect } from 'react';

// Shared dismissal behaviour for the home header dropdowns (Filters,
// Language), replacing react-overlays' rootClose which lets the outside
// click through to whatever sits underneath:
// - an outside click/tap closes the dropdown AND is consumed (capture
//   phase), so it never also activates the post or button under the
//   pointer — first tap dismisses, second tap acts;
// - Escape closes (rootClose used to provide this);
// - the dropdown closes as soon as its anchor scrolls off screen, instead
//   of floating detached over unrelated content.
export const useDropdownDismiss = (open, onClose, containerRef, anchorRef) => {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose, containerRef]);

  useEffect(() => {
    if (!open || !anchorRef.current || !('IntersectionObserver' in window)) {
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          onClose();
        }
      });
    });

    observer.observe(anchorRef.current);

    return () => {
      observer.disconnect();
    };
  }, [open, onClose, anchorRef]);
};
