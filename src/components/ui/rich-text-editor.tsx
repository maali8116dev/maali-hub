import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import "./rich-text-editor.css";

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
    </div>
  );
}