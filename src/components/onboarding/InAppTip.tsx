import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { X, Lightbulb, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type TipType = 'info' | 'success' | 'warning' | 'tip';

interface InAppTipProps {
  id: string;
  title: string;
  description: string;
  type?: TipType;
  dismissible?: boolean;
  onDismiss?: () => void;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const tipConfig = {
  info: {
    icon: Info,
    className: 'border-blue-500/20 bg-blue-500/10 text-blue-500',
  },
  success: {
    icon: CheckCircle,
    className: 'border-green-500/20 bg-green-500/10 text-green-500',
  },
  warning: {
    icon: AlertCircle,
    className: 'border-amber-500/20 bg-amber-500/10 text-amber-500',
  },
  tip: {
    icon: Lightbulb,
    className: 'border-primary/20 bg-primary/10 text-primary',
  },
};

export function InAppTip({
  id,
  title,
  description,
  type = 'tip',
  dismissible = true,
  onDismiss,
  action,
  className,
}: InAppTipProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const dismissedState = localStorage.getItem(`tip-${id}-dismissed`);
    setDismissed(dismissedState === 'true');
  }, [id]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(`tip-${id}-dismissed`, 'true');
    onDismiss?.();
  };

  if (dismissed) {
    return null;
  }

  const config = tipConfig[type];
  const Icon = config.icon;

  return (
    <Alert className={cn(config.className, className)}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <AlertTitle className="text-sm font-medium mb-1">{title}</AlertTitle>
          <AlertDescription className="text-sm">{description}</AlertDescription>
          {action && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={action.onClick}
                className="h-8"
              >
                {action.label}
              </Button>
            </div>
          )}
        </div>
        {dismissible && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 flex-shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </Alert>
  );
}

