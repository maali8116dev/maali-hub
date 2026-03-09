import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "./rich-text-editor.css";

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

  if (!isClient) {
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
    <div className={cn("rich-text-editor", error && "error", className)}>
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
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
    </div>
  );
}