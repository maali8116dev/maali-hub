import { CheckCircle2, LucideIcon } from "lucide-react";

interface ListItemsRendererProps {
  /**
   * The text content to render as a list (newline-separated items)
   */
  items: string;
  
  /**
   * Variant determines the color scheme
   */
  variant?: "primary" | "success" | "warning" | "destructive";
  
  /**
   * Icon to display for non-numbered items
   */
  icon?: LucideIcon;
  
  /**
   * Custom className for the container
   */
  className?: string;
  
  /**
   * Custom className for individual items
   */
  itemClassName?: string;
}

const variantStyles = {
  primary: {
    item: "bg-muted/50 hover:bg-muted/70",
    icon: "text-primary",
    numbered: "bg-primary/10 text-primary",
  },
  success: {
    item: "bg-success/5 hover:bg-success/10 border border-success/10",
    icon: "text-success",
    numbered: "bg-success/20 text-success",
  },
  warning: {
    item: "bg-warning/5 hover:bg-warning/10 border border-warning/10",
    icon: "text-warning",
    numbered: "bg-warning/20 text-warning",
  },
  destructive: {
    item: "bg-destructive/5 hover:bg-destructive/10 border border-destructive/10",
    icon: "text-destructive",
    numbered: "bg-destructive/20 text-destructive",
  },
};

/**
 * Renders a list of items from a newline-separated string.
 * Supports both bulleted and numbered lists with appropriate icons.
 */
export function ListItemsRenderer({
  items,
  variant = "primary",
  icon: Icon = CheckCircle2,
  className = "",
  itemClassName = "",
}: ListItemsRendererProps) {
  const styles = variantStyles[variant];

  const parsedItems = items
    .split("\n")
    .filter((line) => line.trim())
    .map((item) => {
      const cleanedItem = item.replace(/^[-•]\s*/, "").trim();
      const isNumbered = /^\d+[\.\)]\s/.test(cleanedItem);
      const displayText = cleanedItem.replace(/^\d+[\.\)]\s/, "");
      const number = cleanedItem.match(/^\d+/)?.[0];

      return {
        cleanedItem,
        isNumbered,
        displayText: displayText || cleanedItem,
        number,
      };
    });

  if (parsedItems.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {parsedItems.map((item, index) => (
        <div
          key={index}
          className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${styles.item} ${itemClassName}`}
        >
          <div className="flex-shrink-0 mt-0.5">
            {item.isNumbered ? (
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full text-sm font-semibold ${styles.numbered}`}
              >
                {item.number}
              </div>
            ) : (
              <Icon className={`h-5 w-5 flex-shrink-0 ${styles.icon}`} />
            )}
          </div>
          <p className="text-foreground leading-relaxed flex-1 pt-0.5">
            {item.displayText}
          </p>
        </div>
      ))}
    </div>
  );
}

