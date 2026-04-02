import * as React from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

/*
 * On mobile (especially Android), tapping a toolbar button blurs the editor
 * and collapses the selection before the format command runs. Two things fix it:
 *
 * 1. Prevent the default on mousedown, touchstart, and pointerdown on the
 *    toolbar so the browser does not move focus away from the editor.
 *
 * 2. Track the last non-null selection via Quill's selection-change event and
 *    restore it synchronously inside the prevent handler. This covers the Android
 *    case where blur still fires asynchronously despite preventDefault.
 */
export type ExplanationQuillEditorProps = Omit<
  React.ComponentProps<typeof ReactQuill>,
  "ref"
>;

export function ExplanationQuillEditor(props: ExplanationQuillEditorProps) {
  const quillRef = React.useRef<ReactQuill | null>(null);

  React.useEffect(() => {
    let removeListeners: (() => void) | undefined;
    const id = window.setTimeout(() => {
      const rq = quillRef.current;
      if (!rq) return;
      let quill: ReturnType<ReactQuill["getEditor"]>;
      try {
        quill = rq.getEditor();
      } catch {
        return;
      }
      const toolbar = quill.getModule("toolbar") as
        | { container?: HTMLElement }
        | undefined;
      const el = toolbar?.container;
      if (!el) return;

      // Always keep a copy of the last real selection so we can restore it.
      let savedRange: { index: number; length: number } | null = null;

      const onSelectionChange = (
        range: { index: number; length: number } | null,
      ) => {
        if (range !== null) savedRange = range;
      };
      quill.on("selection-change", onSelectionChange);

      const prevent = (e: Event) => {
        e.preventDefault();
        // Restore selection so the toolbar command hits the right range.
        if (savedRange) {
          quill.setSelection(savedRange.index, savedRange.length, "silent");
        }
      };

      el.addEventListener("mousedown", prevent);
      el.addEventListener("touchstart", prevent, { passive: false });
      el.addEventListener("pointerdown", prevent);

      removeListeners = () => {
        el.removeEventListener("mousedown", prevent);
        el.removeEventListener("touchstart", prevent);
        el.removeEventListener("pointerdown", prevent);
        quill.off("selection-change", onSelectionChange);
      };
    }, 0);

    return () => {
      window.clearTimeout(id);
      removeListeners?.();
    };
  }, []);

  return (
    <div className="quill-explanation-editor">
      <ReactQuill ref={quillRef} {...props} />
    </div>
  );
}
