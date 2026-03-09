import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// Lazy load ReactQuill to avoid SSR issues
let ReactQuill: any = null;
if (typeof window !== 'undefined') {
  ReactQuill = require('react-quill').default;
}

interface RichTextEditorProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  error?: boolean;
}

/**
 * Rich text editor component using ReactQuill
 * Features:
 * - Bold, italic, underline formatting
 * - Headers (H1, H2, H3)
 * - Lists (ordered and unordered)
 * - Links
 * - Block quotes
 * - Clean paste functionality
 */
export function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Start writing...",
  className,
  disabled = false,
  error = false,
}: RichTextEditorProps) {
  const [isClient, setIsClient] = useState(false);
  const quillRef = useRef<any>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Toolbar configuration
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      ['blockquote', 'link'],
      ['clean']
    ],
    clipboard: {
      // Clean up pasted HTML
      matchVisual: false,
    }
  };

  const formats = [
    'header',
    'bold', 'italic', 'underline',
    'list', 'bullet',
    'blockquote', 'link'
  ];

  const handleChange = (content: string, delta: any, source: any, editor: any) => {
    // Get clean HTML content
    const html = editor.getHTML();
    onChange(html);
  };

  // Don't render on server side to avoid SSR issues
  if (!isClient || !ReactQuill) {
    return (
      <div className={cn(
        "min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
        "flex items-center justify-center text-muted-foreground",
        error && "border-destructive",
        className
      )}>
        Loading editor...
      </div>
    );
  }

  return (
    <div className={cn("rich-text-editor", className)}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        value={value}
        onChange={handleChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        readOnly={disabled}
        className={cn(
          "bg-background",
          error && "border-destructive",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        style={{
          '--ql-editor-min-height': '150px'
        } as React.CSSProperties}
      />
      
      <style jsx global>{`
        .rich-text-editor .ql-toolbar {
          border-top: 1px solid hsl(var(--border));
          border-left: 1px solid hsl(var(--border));
          border-right: 1px solid hsl(var(--border));
          border-top-left-radius: calc(var(--radius) - 2px);
          border-top-right-radius: calc(var(--radius) - 2px);
          background: hsl(var(--background));
        }
        
        .rich-text-editor .ql-container {
          border-bottom: 1px solid hsl(var(--border));
          border-left: 1px solid hsl(var(--border));
          border-right: 1px solid hsl(var(--border));
          border-bottom-left-radius: calc(var(--radius) - 2px);
          border-bottom-right-radius: calc(var(--radius) - 2px);
          font-family: inherit;
        }
        
        .rich-text-editor .ql-editor {
          min-height: var(--ql-editor-min-height, 150px);
          font-size: 14px;
          line-height: 1.5;
          color: hsl(var(--foreground));
        }
        
        .rich-text-editor .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground));
          font-style: normal;
        }
        
        .rich-text-editor .ql-toolbar .ql-stroke {
          fill: none;
          stroke: hsl(var(--foreground));
        }
        
        .rich-text-editor .ql-toolbar .ql-fill {
          fill: hsl(var(--foreground));
          stroke: none;
        }
        
        .rich-text-editor .ql-toolbar .ql-picker-label {
          color: hsl(var(--foreground));
        }
        
        .rich-text-editor .ql-toolbar button:hover,
        .rich-text-editor .ql-toolbar button:focus {
          color: hsl(var(--accent-foreground));
        }
        
        .rich-text-editor .ql-toolbar button.ql-active {
          color: hsl(var(--primary));
        }
        
        .rich-text-editor .ql-editor h1 {
          font-size: 2em;
          font-weight: bold;
          margin-bottom: 0.5em;
        }
        
        .rich-text-editor .ql-editor h2 {
          font-size: 1.5em;
          font-weight: bold;
          margin-bottom: 0.5em;
        }
        
        .rich-text-editor .ql-editor h3 {
          font-size: 1.25em;
          font-weight: bold;
          margin-bottom: 0.5em;
        }
        
        .rich-text-editor .ql-editor ul,
        .rich-text-editor .ql-editor ol {
          margin-left: 1.5em;
          margin-bottom: 1em;
        }
        
        .rich-text-editor .ql-editor blockquote {
          border-left: 4px solid hsl(var(--border));
          padding-left: 1em;
          margin-left: 0;
          margin-bottom: 1em;
          font-style: italic;
          color: hsl(var(--muted-foreground));
        }
        
        .rich-text-editor .ql-editor a {
          color: hsl(var(--primary));
          text-decoration: underline;
        }
        
        .rich-text-editor .ql-editor a:hover {
          color: hsl(var(--primary)) / 0.8;
        }
        
        ${error ? `
          .rich-text-editor .ql-toolbar,
          .rich-text-editor .ql-container {
            border-color: hsl(var(--destructive));
          }
        ` : ''}
      `}</style>
    </div>
  );
}