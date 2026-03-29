import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button, TruncatedText } from "@shaxmatchi/ui";
import { InlineSpinner } from "../loading";
import { debutsUi } from "./debutsUi";

export function DebutsPageHeader({
  title,
  description,
  contextLabel,
  contextValue,
  loading,
  backTo,
}: {
  title: string;
  description?: string;
  contextLabel?: string;
  contextValue?: string;
  loading?: boolean;
  backTo?: string;
}) {
  const navigate = useNavigate();
  return (
    <div className={debutsUi.headerRow}>
      <div className="min-w-0 flex-1">
        <h1 className={debutsUi.title}>
          <div className="min-w-0">
            <TruncatedText text={title} maxLines={2} className="font-semibold text-inherit" />
          </div>
        </h1>
        {description ? <p className={debutsUi.desc}>{description}</p> : null}
        {contextLabel !== undefined && contextValue !== undefined ? (
          <div className={debutsUi.contextLine}>
            <span className="shrink-0 text-slate-500">{contextLabel}:</span>
            {loading ? <InlineSpinner /> : null}
            <div className="min-w-0 flex-1">
              <TruncatedText text={contextValue} maxLines={2} className="font-medium text-slate-800" />
            </div>
          </div>
        ) : null}
      </div>
      {backTo ? (
        <Button type="button" variant="secondary" size="sm" className="shrink-0" onClick={() => navigate(backTo)}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Orqaga
        </Button>
      ) : null}
    </div>
  );
}
