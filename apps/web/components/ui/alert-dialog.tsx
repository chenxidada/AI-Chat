import * as React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface AlertDialogContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const AlertDialogContext = React.createContext<AlertDialogContextValue | undefined>(undefined);

interface AlertDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

function AlertDialog({ open: controlledOpen, onOpenChange, children }: AlertDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const handleOpenChange = (newOpen: boolean) => {
    setUncontrolledOpen(newOpen);
    onOpenChange?.(newOpen);
  };

  return (
    <AlertDialogContext.Provider value={{ open, onOpenChange: handleOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  );
}

interface AlertDialogTriggerProps {
  children: React.ReactNode;
  asChild?: boolean;
}

function AlertDialogTrigger({ children, asChild }: AlertDialogTriggerProps) {
  const context = React.useContext(AlertDialogContext);
  if (!context) throw new Error('AlertDialogTrigger must be used within AlertDialog');

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<{ onClick?: () => void }>, {
      onClick: () => context.onOpenChange(true),
    });
  }

  return <button onClick={() => context.onOpenChange(true)}>{children}</button>;
}

interface AlertDialogContentProps {
  children: React.ReactNode;
  className?: string;
}

function AlertDialogContent({ children, className }: AlertDialogContentProps) {
  const context = React.useContext(AlertDialogContext);
  if (!context) throw new Error('AlertDialogContent must be used within AlertDialog');

  if (!context.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={() => context.onOpenChange(false)} />
      <div
        className={twMerge(
          clsx(
            'relative z-50 w-full max-w-lg rounded-lg bg-white p-6 shadow-lg',
            className,
          ),
        )}
      >
        {children}
      </div>
    </div>
  );
}

function AlertDialogHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={twMerge('mb-4', className)}>{children}</div>;
}

function AlertDialogTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={twMerge('text-lg font-semibold', className)}>{children}</h2>;
}

function AlertDialogDescription({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={twMerge('text-sm text-gray-500', className)}>{children}</p>;
}

function AlertDialogFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={twMerge('mt-4 flex justify-end gap-2', className)}>
      {children}
    </div>
  );
}

interface AlertDialogActionProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

function AlertDialogAction({ children, className, onClick }: AlertDialogActionProps) {
  const context = React.useContext(AlertDialogContext);
  if (!context) throw new Error('AlertDialogAction must be used within AlertDialog');

  return (
    <button
      className={twMerge(
        clsx(
          'inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white',
          'hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
          className,
        ),
      )}
      onClick={() => {
        onClick?.();
        context.onOpenChange(false);
      }}
    >
      {children}
    </button>
  );
}

function AlertDialogCancel({ children, className }: { children: React.ReactNode; className?: string }) {
  const context = React.useContext(AlertDialogContext);
  if (!context) throw new Error('AlertDialogCancel must be used within AlertDialog');

  return (
    <button
      className={twMerge(
        clsx(
          'inline-flex h-10 items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium',
          'hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2',
          className,
        ),
      )}
      onClick={() => context.onOpenChange(false)}
    >
      {children}
    </button>
  );
}

export {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
};
