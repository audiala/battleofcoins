import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ModelTooltipProps {
  name: string;
  description: string;
  cost: string;
  children: React.ReactNode;
}

export function ModelTooltip({ name, description, cost, children }: ModelTooltipProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    // Check if tooltip would go off the right side of the screen
    const rightOverflow = triggerRect.right + tooltipRect.width > window.innerWidth;

    setPosition({
      x: rightOverflow 
        ? triggerRect.left - tooltipRect.width - 10 + scrollX
        : triggerRect.right + 10 + scrollX,
      y: triggerRect.top + (triggerRect.height - tooltipRect.height) / 2 + scrollY
    });
  };

  useEffect(() => {
    if (showTooltip) {
      updatePosition();
      window.addEventListener('scroll', updatePosition);
      window.addEventListener('resize', updatePosition);
    }

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showTooltip]);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)} // For mobile
        className="tooltip-trigger"
      >
        {children}
      </div>
      {showTooltip && createPortal(
        <div
          ref={tooltipRef}
          className="model-tooltip"
          style={{
            position: 'absolute',
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          <h4>{name}</h4>
          <p className="model-tooltip-description">{description}</p>
          <div className="model-tooltip-cost">{cost}</div>
        </div>,
        document.body
      )}
    </>
  );
} 