import React, { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import styles from './dropdown-menu.module.css';

interface DropdownMenuProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

interface DropdownMenuTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  align?: 'start' | 'end' | 'center';
  side?: 'top' | 'bottom' | 'left' | 'right';
}

interface DropdownMenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  onSelect?: (event: Event) => void;
  variant?: 'default' | 'destructive';
}

interface DropdownMenuSeparatorProps extends React.HTMLAttributes<HTMLHRElement> {}

const DropdownMenuContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.MutableRefObject<HTMLElement | null>;
}>({
  open: false,
  setOpen: () => {},
  triggerRef: { current: null },
});

export const DropdownMenu: React.FC<DropdownMenuProps> = ({
  children,
  open: controlledOpen,
  onOpenChange,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const triggerRef = useRef<HTMLElement | null>(null);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;

  const setOpen = (newOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(newOpen);
    }
    onOpenChange?.(newOpen);
  };

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className={styles.dropdownMenu}>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenuTrigger: React.FC<DropdownMenuTriggerProps> = ({
  children,
  asChild = false,
}) => {
  const { open, setOpen, triggerRef } = React.useContext(DropdownMenuContext);

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      'data-dropdown-trigger': true,
      ref: (el: HTMLElement | null) => {
        triggerRef.current = el;
        if (typeof (children as any).ref === 'function') {
          (children as any).ref(el);
        } else if ((children as any).ref) {
          (children as any).ref.current = el;
        }
      },
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        setOpen(!open);
        if (children.props.onClick) {
          children.props.onClick(e);
        }
      },
    } as any);
  }

  return (
    <div 
      data-dropdown-trigger
      ref={(el) => { triggerRef.current = el; }}
      onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      {children}
    </div>
  );
};

export const DropdownMenuContent: React.FC<DropdownMenuContentProps> = ({
  children,
  align = 'end',
  side = 'bottom',
  className,
  ...props
}) => {
  const { open, setOpen, triggerRef } = React.useContext(DropdownMenuContext);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        contentRef.current && 
        !contentRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    // Use setTimeout to avoid immediate closure
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, setOpen]);

  useEffect(() => {
    if (open && contentRef.current && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      
      let top = rect.bottom + 4;
      let left = rect.right;

      if (side === 'top') {
        top = rect.top - contentRect.height - 4;
      } else if (side === 'left') {
        left = rect.left - contentRect.width - 4;
      } else if (side === 'right') {
        left = rect.right + 4;
      }

      if (align === 'start') {
        left = rect.left;
      } else if (align === 'center') {
        left = rect.left + (rect.width - contentRect.width) / 2;
      } else if (align === 'end') {
        left = rect.right - contentRect.width;
      }

      // Ensure menu stays within viewport
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (left + contentRect.width > viewportWidth) {
        left = viewportWidth - contentRect.width - 8;
      }
      if (left < 8) {
        left = 8;
      }
      if (top + contentRect.height > viewportHeight) {
        top = viewportHeight - contentRect.height - 8;
      }
      if (top < 8) {
        top = 8;
      }

      contentRef.current.style.position = 'fixed';
      contentRef.current.style.top = `${top}px`;
      contentRef.current.style.left = `${left}px`;
    }
  }, [open, align, side]);

  if (!open) return null;

  return (
    <div
      ref={contentRef}
      className={cn(styles.dropdownContent, className)}
      {...props}
    >
      {children}
    </div>
  );
};

export const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({
  children,
  className,
  variant = 'default',
  onSelect,
  onClick,
  ...props
}) => {
  const { setOpen } = React.useContext(DropdownMenuContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    onSelect?.(e.nativeEvent);
    onClick?.(e);
    setOpen(false);
  };

  return (
    <button
      className={cn(
        styles.dropdownMenuItem,
        variant === 'destructive' && styles.dropdownMenuItemDestructive,
        className
      )}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};

export const DropdownMenuSeparator: React.FC<DropdownMenuSeparatorProps> = ({
  className,
  ...props
}) => {
  return (
    <hr
      className={cn(styles.dropdownMenuSeparator, className)}
      {...props}
    />
  );
};
