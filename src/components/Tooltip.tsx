import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

interface TooltipProps {
  content: string;
  parentRef: React.RefObject<HTMLElement>;
  isWinner?: boolean;
}

export function Tooltip({ content, parentRef, isWinner }: TooltipProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!parentRef.current) return;

    const updatePosition = () => {
      const rect = parentRef.current?.getBoundingClientRect();
      if (!rect) return;

      const spaceRight = window.innerWidth - rect.right;
      
      setPosition({
        top: rect.top + window.scrollY + rect.height / 2,
        left: spaceRight > 300 ? rect.right + 16 : rect.left - 296 // 280px width + 16px gap
      });
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [parentRef]);

  return createPortal(
    <div 
      className={`tooltip-portal ${isWinner ? 'winner' : ''}`}
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        transform: 'translateY(-50%)',
      }}
    >
      {content}
    </div>,
    document.body
  );
} 