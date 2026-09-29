"use client";

import React, { forwardRef } from "react";

interface SmartRevealTargetProps extends React.HTMLAttributes<HTMLDivElement> {
  targetKey: string;
  as?: React.ElementType;
  children: React.ReactNode;
  announceLive?: boolean;
}

export const SmartRevealTarget = forwardRef<HTMLDivElement, SmartRevealTargetProps>(
  ({ targetKey, as: Component = "div", children, className = "", announceLive = false, id, ...props }, ref) => {
    return (
      <Component
        ref={ref}
        id={id || targetKey}
        data-saarvi-target={targetKey}
        tabIndex={-1}
        aria-live={announceLive ? "polite" : undefined}
        className={`saarvi-destination-target outline-hidden ${className}`}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

SmartRevealTarget.displayName = "SmartRevealTarget";

export default SmartRevealTarget;
