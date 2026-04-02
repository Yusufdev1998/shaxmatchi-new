import * as React from "react";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";

/**
 * Quill's default toolbar only wires `click`. On mobile, touching the toolbar
 * can blur the editor and collapse or expand the selection before `click` runs,
 * so formatting applies to the wrong range (often "all text"). Preventing the
 * default on `mousedown` / `touchstart` keeps focus and selection stable — the
 * same fix recommended for Quill + touch browsers.
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
      const toolbar = quill.getModule("toolbar") as { container?: HTMLElement } | undefined;
      const el = toolbar?.container;
      if (!el) return;

      const prevent = (e: Event) => {
        e.preventDefault();
      };

      el.addEventListener("mousedown", prevent);
      el.addEventListener("touchstart", prevent, { passive: false });

      removeListeners = () => {
        el.removeEventListener("mousedown", prevent);
        el.removeEventListener("touchstart", prevent);
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
