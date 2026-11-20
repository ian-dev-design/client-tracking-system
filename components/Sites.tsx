// A list of an organization's sites, used on the client profile and the organization page.

import { SITE_CONFIG } from "@/lib/target";
import { formatDate } from "@/lib/util";
import { SiteButton } from "./SiteForm";

// Status shades of forest (darker = further along). Stage colors are kept for the journey only.
const STATUS_BAR: Record<string, string> = { Completed: "bg-forest", "In progress": "bg-forest/60", Scheduled: "bg-forest/30" };

export function SitesList({ sites, organizationId }: { sites: Record<string, string>[]; organizationId: string }) {
  return (
    <div>
      {sites.length ? (
        <ul className="divide-y divide-line border-y border-line">
          {sites.map((s) => (
            <li key={s.id} className="flex items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold">{s.name}</span>
                  {s.size && <span className="text-xs text-muted">{s.size} {SITE_CONFIG.sizeUnit}</span>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5 text-ink"><span className={`h-3 w-[3px] ${STATUS_BAR[s.status] || "bg-line"}`} />{s.status || "—"}</span>
                  {(s.service_start || s.service_end) && (
                    <span>{SITE_CONFIG.serviceLabel}: {formatDate(s.service_start)} – {formatDate(s.service_end)}</span>
                  )}
                  {s.address && <span className="truncate">{s.address}</span>}
                </div>
                {s.notes && <p className="mt-1 text-xs text-muted">{s.notes}</p>}
              </div>
              <SiteButton organizationId={organizationId} site={s} label="Edit" small />
            </li>
          ))}
        </ul>
      ) : <p className="muted">No sites yet.</p>}
      <div className="mt-3"><SiteButton organizationId={organizationId} /></div>
    </div>
  );
}
