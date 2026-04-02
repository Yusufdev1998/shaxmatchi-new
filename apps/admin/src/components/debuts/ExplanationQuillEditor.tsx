import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  List,
  ListOrdered,
  Link as LinkIcon,
  Link2Off,
  RemoveFormatting,
  Highlighter,
  Type,
} from "lucide-react";

export type ExplanationQuillEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

function ToolbarBtn({
  active,
  onMouseDown,
  title,
  children,
}: {
  active?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={onMouseDown}
      className={[
        "flex h-8 w-8 items-center justify-center rounded transition-colors",
        active
          ? "bg-indigo-100 text-indigo-700"
          : "text-slate-600 hover:bg-slate-100",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function ExplanationQuillEditor({
  value,
  onChange,
}: ExplanationQuillEditorProps) {
  const textColorRef = React.useRef<HTMLInputElement>(null);
  const bgColorRef = React.useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Link.configure({ openOnClick: false }),
    ],
    content: value,
    onUpdate({ editor: ed }) {
      onChange(ed.getHTML());
    },
  });

  // Sync when parent resets the value (e.g. dialog opens with existing content)
  const prevValueRef = React.useRef(value);
  React.useEffect(() => {
    if (!editor) return;
    if (value !== prevValueRef.current && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    prevValueRef.current = value;
  }, [value, editor]);

  const cmd = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  const addLink = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!editor) return;
    if (editor.isActive("link")) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    const url = window.prompt("URL kiriting:");
    if (url) {
      editor
        .chain()
        .focus()
        .setLink({ href: url.startsWith("http") ? url : "https://" + url })
        .run();
    }
  };

  if (!editor) return null;

  return (
    <div className="tiptap-editor rounded-xl border border-slate-200 bg-white overflow-hidden">
      {/* Editor content area */}
      <EditorContent editor={editor} />

      {/* Toolbar at the bottom */}
      <div className="flex flex-wrap items-center gap-0.5 border-t border-slate-200 bg-slate-50 px-2 py-1.5">
        <ToolbarBtn
          active={editor.isActive("bold")}
          onMouseDown={cmd(() => editor.chain().focus().toggleBold().run())}
          title="Qalin"
        >
          <Bold className="h-4 w-4" />
        </ToolbarBtn>

        <ToolbarBtn
          active={editor.isActive("italic")}
          onMouseDown={cmd(() => editor.chain().focus().toggleItalic().run())}
          title="Kursiv"
        >
          <Italic className="h-4 w-4" />
        </ToolbarBtn>

        <ToolbarBtn
          active={editor.isActive("underline")}
          onMouseDown={cmd(() => editor.chain().focus().toggleUnderline().run())}
          title="Tagiga chizish"
        >
          <UnderlineIcon className="h-4 w-4" />
        </ToolbarBtn>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        {/* Text color */}
        <ToolbarBtn
          onMouseDown={(e) => {
            e.preventDefault();
            textColorRef.current?.click();
          }}
          title="Matn rangi"
        >
          <Type className="h-4 w-4" />
        </ToolbarBtn>
        <input
          ref={textColorRef}
          type="color"
          className="sr-only"
          defaultValue="#000000"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) =>
            editor.chain().focus().setColor(e.target.value).run()
          }
        />

        {/* Background / highlight color */}
        <ToolbarBtn
          onMouseDown={(e) => {
            e.preventDefault();
            bgColorRef.current?.click();
          }}
          title="Fon rangi"
        >
          <Highlighter className="h-4 w-4" />
        </ToolbarBtn>
        <input
          ref={bgColorRef}
          type="color"
          className="sr-only"
          defaultValue="#ffff00"
          onMouseDown={(e) => e.stopPropagation()}
          onChange={(e) =>
            editor
              .chain()
              .focus()
              .setHighlight({ color: e.target.value })
              .run()
          }
        />

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <ToolbarBtn
          active={editor.isActive("orderedList")}
          onMouseDown={cmd(() =>
            editor.chain().focus().toggleOrderedList().run(),
          )}
          title="Raqamli ro'yxat"
        >
          <ListOrdered className="h-4 w-4" />
        </ToolbarBtn>

        <ToolbarBtn
          active={editor.isActive("bulletList")}
          onMouseDown={cmd(() =>
            editor.chain().focus().toggleBulletList().run(),
          )}
          title="Belgili ro'yxat"
        >
          <List className="h-4 w-4" />
        </ToolbarBtn>

        <div className="mx-1 h-5 w-px bg-slate-200" />

        <ToolbarBtn
          active={editor.isActive("link")}
          onMouseDown={addLink}
          title={editor.isActive("link") ? "Linkni olib tashlash" : "Link qo'shish"}
        >
          {editor.isActive("link") ? (
            <Link2Off className="h-4 w-4" />
          ) : (
            <LinkIcon className="h-4 w-4" />
          )}
        </ToolbarBtn>

        <ToolbarBtn
          onMouseDown={cmd(() =>
            editor.chain().focus().clearNodes().unsetAllMarks().run(),
          )}
          title="Formatlashni tozalash"
        >
          <RemoveFormatting className="h-4 w-4" />
        </ToolbarBtn>
      </div>
    </div>
  );
}
