"use client";

import { useMemo, useState } from "react";
import { formatAdminDate, interpolate, type AdminDict, type AdminLocale } from "@/lib/admin-i18n";
import type {
  EcosystemAccessStatus,
  EcosystemMemberRef,
  EcosystemUserRow,
  EcosystemWorkspaceRow,
} from "@/lib/ecosystem-types";

const SEARCH_ICON = "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3";

type Tab = "users" | "workspaces";
type Filter = "all" | EcosystemAccessStatus;
type Copy = AdminDict["ecosystem"];

const USER_FILTERS: Filter[] = ["all", "trial_active", "lifetime", "trial_expired", "paid"];
const WORKSPACE_FILTERS: Filter[] = ["all", "trial_active", "lifetime", "trial_expired", "paid"];

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d={SEARCH_ICON} />
    </svg>
  );
}

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function statusLabel(status: EcosystemAccessStatus, t: Copy): string {
  switch (status) {
    case "trial_active":
      return t.statusTrialActive;
    case "trial_expired":
      return t.statusTrialExpired;
    case "lifetime":
      return t.statusLifetime;
    case "paid":
      return t.statusPaid;
    case "redeem":
      return t.statusRedeem;
    default:
      return t.statusNone;
  }
}

function filterLabel(filter: Filter, t: Copy): string {
  return filter === "all" ? t.filterAll : statusLabel(filter, t);
}

function roleLabel(role: EcosystemMemberRef["role"], t: Copy): string {
  if (role === "owner") return t.roleOwner;
  if (role === "admin") return t.roleAdmin;
  return t.roleMember;
}

function planLabel(planId: string, t: Copy): string | null {
  if (planId === "starter") return t.starter;
  if (planId === "pro") return t.pro;
  if (planId === "business") return t.business;
  return planId || null;
}

function formatWhen(value: string | null, lang: AdminLocale, withTime = false): string {
  if (!value) return "";
  return formatAdminDate(value, lang, withTime
    ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }
    : { day: "numeric", month: "short", year: "numeric" });
}

function userHaystack(row: EcosystemUserRow): string {
  return [row.name, row.email, ...row.workspaces.flatMap((item) => [item.name, item.slug])].join(" ").toLowerCase();
}

function workspaceHaystack(row: EcosystemWorkspaceRow): string {
  return [row.name, row.slug, ...row.members.flatMap((item) => [item.name, item.email])].join(" ").toLowerCase();
}

function userMatchesFilter(row: EcosystemUserRow, filter: Filter): boolean {
  if (filter === "all") return true;
  if (row.workspaces.some((item) => item.status === filter)) return true;
  return row.workspaces.length === 0 && row.status === filter;
}

function countUsers(rows: EcosystemUserRow[], filter: Filter): number {
  return rows.filter((row) => userMatchesFilter(row, filter)).length;
}

function countWorkspaces(rows: EcosystemWorkspaceRow[], filter: Filter): number {
  return rows.filter((row) => (filter === "all" ? true : row.status === filter)).length;
}

function StatusPill({ status, t }: { status: EcosystemAccessStatus; t: Copy }) {
  return (
    <span className="eco-status" data-status={status}>
      {statusLabel(status, t)}
    </span>
  );
}

function PaidNote({
  row,
  t,
  lang,
}: {
  row: Pick<EcosystemWorkspaceRow, "status" | "subscriptionStatus" | "periodEnd" | "cancelAtPeriodEnd" | "overrideUntil">;
  t: Copy;
  lang: AdminLocale;
}) {
  if (row.status === "redeem" && row.overrideUntil) {
    const when = formatWhen(row.overrideUntil, lang);
    return when ? <small className="eco-note">{interpolate(t.redeemUntil, { when })}</small> : null;
  }
  if (row.status !== "paid") return null;
  if (row.subscriptionStatus === "past_due") return <small className="eco-note">{t.paidPastDue}</small>;
  const when = formatWhen(row.periodEnd, lang);
  if (row.cancelAtPeriodEnd && when) return <small className="eco-note">{interpolate(t.paidCanceling, { when })}</small>;
  if (when) return <small className="eco-note">{interpolate(t.paidUntil, { when })}</small>;
  return null;
}

function Filters({
  filters,
  current,
  counts,
  t,
  onChange,
}: {
  filters: Filter[];
  current: Filter;
  counts: Record<Filter, number>;
  t: Copy;
  onChange: (filter: Filter) => void;
}) {
  const visible = filters.filter((filter) => filter === "all" || filter === current || counts[filter] > 0);
  // Always include redeem/none when they have rows, even if not in the default quick set.
  return (
    <div className="eco-filters" role="group" aria-label={t.filterAria}>
      {visible.map((filter) => (
        <button
          key={filter}
          type="button"
          className="eco-filter"
          data-status={filter === "all" ? undefined : filter}
          aria-pressed={current === filter}
          onClick={() => onChange(filter)}
        >
          {filter !== "all" ? <i aria-hidden="true" /> : null}
          <span>{filterLabel(filter, t)}</span>
          <b>{counts[filter]}</b>
        </button>
      ))}
    </div>
  );
}

function QuotesDirectoryFallback({ t }: { t: Copy }) {
  return (
    <section className="eco-dir">
      <div className="eco-dir-empty">
        <h2>{t.tabUsers}</h2>
        <p>{t.directoryUnavailable}</p>
      </div>
    </section>
  );
}

export function QuotesDirectory({
  t,
  lang,
  users,
  workspaces,
}: {
  t: Copy;
  lang: AdminLocale;
  users?: EcosystemUserRow[];
  workspaces?: EcosystemWorkspaceRow[];
}) {
  const [tab, setTab] = useState<Tab>("users");
  const [userFilter, setUserFilter] = useState<Filter>("all");
  const [workspaceFilter, setWorkspaceFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const q = norm(query);

  const userFilters = useMemo(() => {
    const extra: Filter[] = [];
    if (users?.some((row) => userMatchesFilter(row, "redeem"))) extra.push("redeem");
    if (users?.some((row) => userMatchesFilter(row, "none"))) extra.push("none");
    return [...USER_FILTERS, ...extra];
  }, [users]);

  const workspaceFilters = useMemo(() => {
    const extra: Filter[] = [];
    if (workspaces?.some((row) => row.status === "redeem")) extra.push("redeem");
    if (workspaces?.some((row) => row.status === "none")) extra.push("none");
    return [...WORKSPACE_FILTERS, ...extra];
  }, [workspaces]);

  const searchedUsers = useMemo(
    () => (users ?? []).filter((row) => !q || userHaystack(row).includes(q)),
    [users, q],
  );
  const searchedWorkspaces = useMemo(
    () => (workspaces ?? []).filter((row) => !q || workspaceHaystack(row).includes(q)),
    [workspaces, q],
  );

  const visibleUsers = searchedUsers.filter((row) => userMatchesFilter(row, userFilter));
  const visibleWorkspaces = searchedWorkspaces.filter((row) => workspaceFilter === "all" || row.status === workspaceFilter);

  if (users == null && workspaces == null) return <QuotesDirectoryFallback t={t} />;

  const userCounts = Object.fromEntries(userFilters.map((filter) => [filter, countUsers(users ?? [], filter)])) as Record<Filter, number>;
  const workspaceCounts = Object.fromEntries(workspaceFilters.map((filter) => [filter, countWorkspaces(workspaces ?? [], filter)])) as Record<Filter, number>;

  return (
    <section className="eco-dir">
      <div className="eco-dir-head">
        <div>
          <h2>{tab === "users" ? t.tabUsers : t.tabWorkspaces}</h2>
          <p>{t.directoryLead}</p>
        </div>
        <nav className="eco-dir-tabs" aria-label={t.directoryLead}>
          <button type="button" aria-current={tab === "users" ? "page" : undefined} onClick={() => setTab("users")}>
            {t.tabUsers}
            <span>{users?.length ?? 0}</span>
          </button>
          <button type="button" aria-current={tab === "workspaces" ? "page" : undefined} onClick={() => setTab("workspaces")}>
            {t.tabWorkspaces}
            <span>{workspaces?.length ?? 0}</span>
          </button>
        </nav>
      </div>

      {tab === "users" && users == null ? (
        <p className="eco-dir-fallback">{t.directoryUnavailable}</p>
      ) : tab === "workspaces" && workspaces == null ? (
        <p className="eco-dir-fallback">{t.directoryUnavailable}</p>
      ) : (
        <>
          <div className="eco-dir-toolbar">
            <label className="eco-search">
              <SearchIcon />
              <span className="adm-sr">{tab === "users" ? t.searchUsers : t.searchWorkspaces}</span>
              <input
                name="q"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tab === "users" ? t.searchUsers : t.searchWorkspaces}
                autoComplete="off"
              />
            </label>
            <Filters
              filters={tab === "users" ? userFilters : workspaceFilters}
              current={tab === "users" ? userFilter : workspaceFilter}
              counts={tab === "users" ? userCounts : workspaceCounts}
              t={t}
              onChange={tab === "users" ? setUserFilter : setWorkspaceFilter}
            />
          </div>

          {tab === "users" ? (
            visibleUsers.length === 0 ? (
              <p className="eco-dir-empty-inline">{q || userFilter !== "all" ? t.emptyFilteredUsers : t.emptyUsers}</p>
            ) : (
              <div className="eco-dir-table-wrap">
                <table className="eco-dir-table">
                  <thead>
                    <tr>
                      <th>{t.colPerson}</th>
                      <th>{t.colStatus}</th>
                      <th className="eco-col-trial">{t.colTrialEnds}</th>
                      <th className="eco-col-linked">{t.colWorkspaces}</th>
                      <th className="eco-col-created">{t.colSignedUp}</th>
                      <th className="eco-col-seen">{t.colLastSeen}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleUsers.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="eco-person">
                            <strong>{row.name}</strong>
                            <span>{row.email}</span>
                          </div>
                        </td>
                        <td>
                          <div className="eco-status-cell">
                            <StatusPill status={row.status} t={t} />
                            {planLabel(row.workspaces.find((item) => item.status === row.status)?.planId ?? "", t) && row.status !== "none" && row.status !== "trial_expired" && row.status !== "trial_active" ? (
                              <small className="eco-note">{planLabel(row.workspaces.find((item) => item.status === row.status)?.planId ?? "", t)}</small>
                            ) : null}
                            {(row.status === "trial_active" || row.status === "trial_expired") && row.trialEndsAt ? (
                              <small className="eco-note eco-note-trial">{formatWhen(row.trialEndsAt, lang)}</small>
                            ) : null}
                          </div>
                        </td>
                        <td className="eco-col-trial">
                          {row.trialEndsAt ? formatWhen(row.trialEndsAt, lang) : t.emptyCell}
                        </td>
                        <td className="eco-col-linked">
                          {row.workspaces.length === 0 ? t.emptyCell : (
                            <ul className="eco-linked">
                              {row.workspaces.map((item) => (
                                <li key={item.id}>
                                  <span>{item.name}</span>
                                  <em>{roleLabel(item.role, t)}</em>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="eco-col-created">{formatWhen(row.createdAt, lang)}</td>
                        <td className="eco-col-seen">{row.lastSeenAt ? formatWhen(row.lastSeenAt, lang, true) : t.neverSeen}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : visibleWorkspaces.length === 0 ? (
            <p className="eco-dir-empty-inline">{q || workspaceFilter !== "all" ? t.emptyFilteredWorkspaces : t.emptyWorkspaces}</p>
          ) : (
            <div className="eco-dir-table-wrap">
              <table className="eco-dir-table">
                <thead>
                  <tr>
                    <th>{t.colWorkspace}</th>
                    <th>{t.colStatus}</th>
                    <th>{t.colOwner}</th>
                    <th className="eco-col-members">{t.colMembers}</th>
                    <th className="ds-num eco-col-quotes">{t.colQuotes}</th>
                    <th className="eco-col-created">{t.colCreated}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleWorkspaces.map((row) => {
                    const owner = row.members.find((member) => member.role === "owner") ?? row.members[0];
                    const others = row.members.filter((member) => member !== owner);
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className="eco-person">
                            <strong>{row.name}</strong>
                            <span>{row.slug}</span>
                          </div>
                        </td>
                        <td>
                          <StatusPill status={row.status} t={t} />
                          {planLabel(row.planId, t) && row.status !== "none" && row.status !== "trial_expired" && row.status !== "trial_active" ? (
                            <small className="eco-note">{planLabel(row.planId, t)}</small>
                          ) : null}
                          <PaidNote row={row} t={t} lang={lang} />
                          {row.status === "trial_active" && row.trialEndsAt ? (
                            <small className="eco-note">{formatWhen(row.trialEndsAt, lang)}</small>
                          ) : null}
                        </td>
                        <td>
                          {owner ? (
                            <div className="eco-person">
                              <strong>{owner.name}</strong>
                              <span>{owner.email}</span>
                            </div>
                          ) : t.emptyCell}
                        </td>
                        <td className="eco-col-members">
                          {others.length === 0 ? t.emptyCell : (
                            <ul className="eco-linked">
                              {others.map((member) => (
                                <li key={member.id}>
                                  <span>{member.name}</span>
                                  <em>{roleLabel(member.role, t)}</em>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                        <td className="ds-num eco-col-quotes">{row.quoteCount}</td>
                        <td className="eco-col-created">{formatWhen(row.createdAt, lang)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
