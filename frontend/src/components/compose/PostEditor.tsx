import { useEffect } from "react";
import clsx from "clsx";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Hash, Italic, Link2, List, ListOrdered, Redo2, Undo2, type LucideIcon } from "lucide-react";
import { textToHtml } from "@/lib/richText";

function ToolButton({ icon: Icon, label, active, disabled, onClick }: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      // Keep the editor selection while clicking toolbar buttons.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={clsx(
        "cursor-pointer rounded p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active ? "bg-primary-100 text-primary-700" : "text-gray-600 hover:bg-gray-200 hover:text-gray-900",
      )}
    >
      <Icon size={16} />
    </button>
  );
}

// Rich-text editor. `content` and `onChange` are HTML; the backend flattens it
// to platform-safe plain text at publish time (see lib/richText.ts).
export default function PostEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        strike: false,
        underline: false,
        link: { openOnClick: false, autolink: true },
      }),
      Placeholder.configure({ placeholder: "What do you want to share?" }),
    ],
    content: textToHtml(content),
    onUpdate: ({ editor: ed }) => onChange(ed.isEmpty ? "" : ed.getHTML()),
    editorProps: {
      attributes: { class: "min-h-[200px] px-4 py-3 text-sm text-gray-900 focus:outline-none" },
    },
  });

  // Follow external changes (switching platform, applying AI content, loading a post).
  useEffect(() => {
    if (!editor) return;
    const next = textToHtml(content);
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (next !== current) editor.commands.setContent(next, { emitUpdate: false });
  }, [content, editor]);

  function setLink() {
    if (!editor) return;
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL (leave empty to remove)", previous ?? "https://");
    if (url === null) return;
    if (url.trim() === "") editor.chain().focus().extendMarkRange("link").unsetLink().run();
    else editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  function insertHashtag() {
    if (!editor) return;
    const { from } = editor.state.selection;
    const before = editor.state.doc.textBetween(Math.max(0, from - 1), from);
    editor.chain().focus().insertContent(before && !/\s/.test(before) ? " #" : "#").run();
  }

  return (
    <div className="rounded-lg border border-gray-300 transition-colors focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-500/20">
      <div className="flex flex-wrap items-center gap-1 rounded-t-lg border-b border-gray-200 bg-gray-50 px-1 py-1.5">
        <ToolButton icon={Bold} label="Bold" active={editor?.isActive("bold")} onClick={() => editor?.chain().focus().toggleBold().run()} />
        <ToolButton icon={Italic} label="Italic" active={editor?.isActive("italic")} onClick={() => editor?.chain().focus().toggleItalic().run()} />
        <ToolButton icon={List} label="Bulleted list" active={editor?.isActive("bulletList")} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
        <ToolButton icon={ListOrdered} label="Numbered list" active={editor?.isActive("orderedList")} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
        <ToolButton icon={Link2} label="Link" active={editor?.isActive("link")} onClick={setLink} />
        <ToolButton icon={Hash} label="Insert hashtag" onClick={insertHashtag} />
        <span className="mx-1 h-5 w-px bg-gray-200" />
        <ToolButton icon={Undo2} label="Undo" disabled={!editor?.can().undo()} onClick={() => editor?.chain().focus().undo().run()} />
        <ToolButton icon={Redo2} label="Redo" disabled={!editor?.can().redo()} onClick={() => editor?.chain().focus().redo().run()} />
      </div>
      <EditorContent
        editor={editor}
        className="post-editor max-h-[480px] overflow-y-auto"
      />
    </div>
  );
}
