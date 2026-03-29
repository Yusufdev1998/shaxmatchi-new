import * as React from "react";
import { Link } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@shaxmatchi/ui";

export type AdminCrumb = { label: string; to?: string };

export function AdminBreadcrumb({ items, compact }: { items: AdminCrumb[]; compact?: boolean }) {
  if (!items.length) return null;

  const lastIdx = items.length - 1;
  return (
    <Breadcrumb>
      <BreadcrumbList className={compact ? "gap-1 text-xs text-slate-500" : undefined}>
        {items.map((item, idx) => {
          const isLast = idx === lastIdx;
          return (
            <React.Fragment key={`${idx}-${item.label}`}>
              <BreadcrumbItem>
                {isLast || !item.to ? (
                  <BreadcrumbPage>{item.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast ? <BreadcrumbSeparator /> : null}
            </React.Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

