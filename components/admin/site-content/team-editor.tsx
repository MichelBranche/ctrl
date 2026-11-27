"use client";

import { useAdminLocale } from "@/components/admin/locale-provider";
import { interpolate } from "@/lib/admin-i18n";
import {
  emptyInput,
  slugifyName,
  type SiteTeamInput,
  type SiteTeamMember,
} from "@/lib/site-team-core";
import Image from "next/image";
import { useEffect, useId, useRef, useState, useTransition, type DragEvent, type FormEvent } from "react";

const I = (d: string) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

async function compressTeamPhoto(file: File): Promise<string> {
  if (file.size > 8 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("photoInvalid");
  const bitmap = await createImageBitmap(file);
  const max = 900;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("photoUnreadable"); }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  let dataUrl = "";
  try { dataUrl = canvas.toDataURL("image/webp", 0.82); } catch { dataUrl = ""; }
  if (!dataUrl.startsWith("data:image/webp") || dataUrl.length > 500_000) dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  if (dataUrl.length > 500_000) throw new Error("photoHeavy");
  return dataUrl;
}

type ApiOk = { ok: true; member?: SiteTeamMember; ids?: string[] };
type ApiErr = { error: string; field?: string; status: number };

async function mutate(payload: Record<string, unknown>): Promise<ApiOk | ApiErr> {
  const response = await fetch("/api/admin/site-team", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({})) as { error?: string; field?: string; member?: SiteTeamMember; ids?: string[] };
  if (!response.ok) return { error: data.error || "", field: data.field, status: response.status };
  return { ok: true, member: data.member, ids: data.ids };
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}

function toInput(member: SiteTeamMember): SiteTeamInput {
  return {
    slug: member.slug,
    name: member.name,
    roleIt: member.roleIt,
    roleEn: member.roleEn,
    bioIt: member.bioIt,
    bioEn: member.bioEn,
    skills: member.skills,
    photoUrl: member.photoUrl,
    photoFocus: member.photoFocus,
    group: member.group,
    socials: { ...member.socials },
    isActive: member.isActive,
  };
}

function replaceMember(list: SiteTeamMember[], member: SiteTeamMember) {
  return list.map((item) => (item.id === member.id ? member : item));
}

export function TeamEditor({ members: initial, dbOk }: { members: SiteTeamMember[]; dbOk: boolean }) {
  const { t } = useAdminLocale();
  const copy = t.siteContent;
  const [members, setMembers] = useState(initial);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState<"new" | SiteTeamMember | null>(null);
  const [removing, setRemoving] = useState<SiteTeamMember | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const visible = members.filter((m) => m.isActive).length;
  const hidden = members.length - visible;

  const fail = (error: ApiErr) => {
    const text = error.status === 401 ? copy.session : error.status === 403 ? copy.forbidden : error.error || copy.genericError;
    setMessage({ text, tone: "error" });
    return text;
  };

  const run = (work: () => Promise<void>) => start(async () => {
    try { await work(); }
    catch { setMessage({ text: copy.genericError, tone: "error" }); }
  });

  const toggle = (member: SiteTeamMember) => run(async () => {
    const result = await mutate({ action: "toggle", id: member.id, isActive: !member.isActive });
    if ("error" in result) { fail(result); return; }
    if (result.member) {
      setMembers((list) => replaceMember(list, result.member!));
      setMessage({ text: interpolate(result.member.isActive ? copy.toggledOn : copy.toggledOff, { name: result.member.name }), tone: "ok" });
    }
  });

  const move = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= members.length) return;
    const ids = members.map((m) => m.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    const previous = members;
    setMembers(ids.map((id) => previous.find((m) => m.id === id)!));
    run(async () => {
      const result = await mutate({ action: "reorder", ids });
      if ("error" in result) { setMembers(previous); fail(result); return; }
      setMessage({ text: copy.reordered, tone: "ok" });
    });
  };

  const dropAt = (targetId: string) => {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const ids = members.map((m) => m.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    const previous = members;
    setMembers(ids.map((id) => previous.find((m) => m.id === id)!));
    setDragId(null);
    setOverId(null);
    run(async () => {
      const result = await mutate({ action: "reorder", ids });
      if ("error" in result) { setMembers(previous); fail(result); return; }
      setMessage({ text: copy.reordered, tone: "ok" });
    });
  };

  const onDragStart = (event: DragEvent<HTMLElement>, id: string) => {
    setDragId(id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  };

  if (!dbOk) {
    return (
      <section className="sc-panel">
        <div className="ds-empty">
          <h2 className="ds-empty-title">{copy.dbDown}</h2>
          <p>{copy.dbDownBody}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="sc-panel">
      <div className="sc-toolbar">
        <p className="sc-stats">
          <span><strong>{members.length}</strong> {copy.all.toLowerCase()}</span>
          <span>· {visible} {copy.visible.toLowerCase()}</span>
          {hidden ? <span>· {hidden} {copy.hidden.toLowerCase()}</span> : null}
        </p>
        <button type="button" className="rb-cta rb-cta-sm" onClick={() => setEditing("new")} disabled={pending}>
          {copy.add}
          {I("M12 5v14M5 12h14")}
        </button>
      </div>
      {members.length ? (
        <ul className="sc-list">
          {members.map((member, index) => (
            <li
              key={member.id}
              className="sc-row"
              data-active={member.isActive ? "1" : "0"}
              data-dragging={dragId === member.id ? "" : undefined}
              data-over={overId === member.id && dragId !== member.id ? "" : undefined}
              onDragOver={(event) => { event.preventDefault(); setOverId(member.id); }}
              onDrop={(event) => { event.preventDefault(); dropAt(member.id); }}
              onDragEnd={() => { setDragId(null); setOverId(null); }}
            >
              <button type="button" className="sc-handle" draggable onDragStart={(event) => onDragStart(event, member.id)} aria-label={copy.drag} disabled={pending}>
                {I("M8 7h.01M12 7h.01M16 7h.01M8 12h.01M12 12h.01M16 12h.01M8 17h.01M12 17h.01M16 17h.01")}
              </button>
              <span className="sc-move">
                <button type="button" className="sc-iconbtn" aria-label={copy.moveUp} disabled={pending || index === 0} onClick={() => move(index, -1)}>{I("M6 14l6-6 6 6")}</button>
                <button type="button" className="sc-iconbtn" aria-label={copy.moveDown} disabled={pending || index === members.length - 1} onClick={() => move(index, 1)}>{I("M6 10l6 6 6-6")}</button>
              </span>
              <span className="sc-photo" aria-hidden="true">
                {member.photo ? <Image src={member.photo} alt="" width={48} height={48} unoptimized style={{ objectPosition: member.photoFocus }} /> : initials(member.name)}
              </span>
              <div className="sc-who">
                <strong>{member.name}</strong>
                <span>{member.roleIt || member.roleEn || "—"}</span>
                <span className="sc-meta">
                  <span className="sc-chip" data-tone={member.group}>{member.group === "founder" ? copy.groupFounder : copy.groupTeam}</span>
                  {member.isActive ? null : <span className="sc-chip" data-tone="off">{copy.hiddenLabel}</span>}
                </span>
              </div>
              <div className="sc-actions">
                <button type="button" className="sc-switch" data-on={member.isActive ? "" : undefined} disabled={pending} onClick={() => toggle(member)} aria-pressed={member.isActive}>
                  <i /><span>{member.isActive ? copy.shown : copy.hiddenLabel}</span>
                </button>
                <button type="button" className="rb-btn" disabled={pending} onClick={() => setEditing(member)}>{copy.edit}</button>
                <button type="button" className="rb-btn sc-danger" disabled={pending} onClick={() => setRemoving(member)}>{copy.remove}</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ds-empty">
          <h2 className="ds-empty-title">{copy.empty}</h2>
          <p>{copy.emptyBody}</p>
        </div>
      )}
      <p className="sc-toast" role="status" data-tone={message?.tone}>{message?.text ?? ""}</p>
      {editing ? (
        <MemberDialog
          title={editing === "new" ? copy.newTitle : interpolate(copy.editTitle, { name: editing.name })}
          initial={editing === "new" ? emptyInput() : toInput(editing)}
          memberId={editing === "new" ? null : editing.id}
          currentPhoto={editing === "new" ? null : editing.photo}
          busy={pending}
          onClose={() => setEditing(null)}
          onSaved={(member, created) => {
            setMembers((list) => created ? [...list, member] : replaceMember(list, member));
            setEditing(null);
            setMessage({ text: copy.saved, tone: "ok" });
          }}
          onPhoto={(member, kind) => {
            setMembers((list) => replaceMember(list, member));
            setMessage({ text: kind === "saved" ? copy.photoSaved : copy.photoCleared, tone: "ok" });
          }}
          onError={(error, field) => fail({ error, status: 400, field })}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog
          title={interpolate(copy.deleteTitle, { name: removing.name })}
          body={copy.deleteBody}
          confirmLabel={copy.deleteConfirm}
          cancelLabel={copy.cancel}
          busy={pending}
          onClose={() => setRemoving(null)}
          onConfirm={() => run(async () => {
            const id = removing.id;
            const result = await mutate({ action: "delete", id });
            if ("error" in result) { fail(result); return; }
            setMembers((list) => list.filter((item) => item.id !== id));
            setRemoving(null);
            setMessage({ text: interpolate(copy.deleted, { name: removing.name }), tone: "ok" });
          })}
        />
      ) : null}
    </section>
  );
}

function MemberDialog({ title, initial, memberId, currentPhoto, busy, onClose, onSaved, onPhoto, onError }: {
  title: string;
  initial: SiteTeamInput;
  memberId: string | null;
  currentPhoto: string | null;
  busy: boolean;
  onClose: () => void;
  onSaved: (member: SiteTeamMember, created: boolean) => void;
  onPhoto: (member: SiteTeamMember, kind: "saved" | "cleared") => void;
  onError: (error: string, field?: string) => string;
}) {
  const { t } = useAdminLocale();
  const copy = t.siteContent;
  const ref = useRef<HTMLDialogElement>(null);
  const fileId = useId();
  const [form, setForm] = useState(initial);
  const [slugTouched, setSlugTouched] = useState(Boolean(initial.slug));
  const [pendingPhoto, setPendingPhoto] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentPhoto);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const onCancel = (event: Event) => { event.preventDefault(); onClose(); };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [onClose]);

  const set = <K extends keyof SiteTeamInput>(key: K, value: SiteTeamInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (key === "name" && !slugTouched) setForm((current) => ({ ...current, name: value as string, slug: slugifyName(value as string) }));
  };

  const uploadChosen = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await compressTeamPhoto(file);
      setPendingPhoto(dataUrl);
      setPreview(dataUrl);
    } catch (caught) {
      const key = caught instanceof Error ? caught.message : "photoUnreadable";
      setError(key === "photoInvalid" ? copy.photoInvalid : key === "photoHeavy" ? copy.photoHeavy : copy.photoUnreadable);
    }
  };

  const sendPhoto = async (id: string, dataUrl: string) => {
    const result = await mutate({ action: "uploadPhoto", id, dataUrl });
    if ("error" in result) return result;
    if (result.member) onPhoto(result.member, "saved");
    return result;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldError(null);
    const payload = { ...form, slug: form.slug || slugifyName(form.name) };
    const result = memberId
      ? await mutate({ action: "update", id: memberId, member: payload })
      : await mutate({ action: "create", member: payload });
    if ("error" in result) {
      setSaving(false);
      setFieldError(result.field ?? null);
      setError(onError(result.error, result.field));
      return;
    }
    let member = result.member;
    if (member && pendingPhoto) {
      const photo = await sendPhoto(member.id, pendingPhoto);
      if ("error" in photo) {
        setSaving(false);
        setError(onError(photo.error));
        if (memberId) return;
        // The person was created; keep the dialog closed only if update path. For create, still close after showing the error on the list.
        onSaved(member, !memberId);
        return;
      }
      member = photo.member ?? member;
    }
    setSaving(false);
    if (member) onSaved(member, !memberId);
  };

  const clearPhoto = async () => {
    if (!memberId) { setPendingPhoto(null); setPreview(null); return; }
    if (pendingPhoto) { setPendingPhoto(null); setPreview(currentPhoto); return; }
    setSaving(true);
    const result = await mutate({ action: "clearPhoto", id: memberId });
    setSaving(false);
    if ("error" in result) { setError(onError(result.error)); return; }
    if (result.member) {
      setPreview(result.member.photo);
      setForm((current) => ({ ...current, photoUrl: "" }));
      onPhoto(result.member, "cleared");
    }
  };

  const locked = busy || saving;
  const field = (key: string) => (fieldError === key ? "" : undefined);

  return (
    <dialog ref={ref} className="sc-dialog" aria-labelledby="sc-member-title" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="sc-dialog-head">
        <h2 id="sc-member-title">{title}</h2>
        <button type="button" className="sc-iconbtn" onClick={onClose} aria-label={copy.cancel} disabled={locked}>{I("M6 6l12 12M18 6L6 18")}</button>
      </div>
      <form className="sc-form" onSubmit={submit}>
        <div className="sc-fields">
          <label className="sc-field" data-invalid={field("name")}>
            <span>{copy.name}</span>
            <input value={form.name} maxLength={80} required autoComplete="name" onChange={(e) => set("name", e.target.value)} />
          </label>
          <label className="sc-field" data-invalid={field("slug")}>
            <span>{copy.slug}</span>
            <input value={form.slug} maxLength={80} autoComplete="off" onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} />
            <small>{copy.slugHint}</small>
          </label>
        </div>
        <div className="sc-fields-2">
          <label className="sc-field" data-invalid={field("roleIt")}>
            <span>{copy.roleIt}</span>
            <input value={form.roleIt} maxLength={160} onChange={(e) => set("roleIt", e.target.value)} />
          </label>
          <label className="sc-field" data-invalid={field("roleEn")}>
            <span>{copy.roleEn}</span>
            <input value={form.roleEn} maxLength={160} onChange={(e) => set("roleEn", e.target.value)} />
          </label>
          <label className="sc-field" data-invalid={field("bioIt")}>
            <span>{copy.bioIt}</span>
            <textarea value={form.bioIt} maxLength={1200} onChange={(e) => set("bioIt", e.target.value)} />
          </label>
          <label className="sc-field" data-invalid={field("bioEn")}>
            <span>{copy.bioEn}</span>
            <textarea value={form.bioEn} maxLength={1200} onChange={(e) => set("bioEn", e.target.value)} />
          </label>
        </div>
        <label className="sc-field">
          <span>{copy.skills}</span>
          <input value={form.skills.join(", ")} onChange={(e) => set("skills", e.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
          <small>{copy.skillsHint}</small>
        </label>
        <label className="sc-field">
          <span>{copy.group}</span>
          <select value={form.group} onChange={(e) => set("group", e.target.value === "founder" ? "founder" : "team")}>
            <option value="founder">{copy.groupFounder}</option>
            <option value="team">{copy.groupTeam}</option>
          </select>
          <small>{copy.groupHint}</small>
        </label>
        <div className="sc-field">
          <span>{copy.photo}</span>
          <small>{copy.photoHint}</small>
          <div className="sc-photo-edit">
            <span className="sc-photo" aria-hidden="true">
              {preview ? <Image src={preview} alt="" width={72} height={72} unoptimized style={{ objectPosition: form.photoFocus }} /> : initials(form.name || "?")}
            </span>
            <label className="rb-btn" htmlFor={fileId} aria-disabled={locked || undefined}>
              {copy.photoChoose}
              <input id={fileId} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={locked} onChange={(e) => { void uploadChosen(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {preview ? <button type="button" className="rb-btn rb-btn-quiet" disabled={locked} onClick={() => void clearPhoto()}>{copy.photoRemove}</button> : null}
          </div>
          <label className="sc-field" data-invalid={field("photoUrl")}>
            <span>{copy.photoUrl}</span>
            <input value={form.photoUrl} placeholder={copy.photoUrlPlaceholder} onChange={(e) => { set("photoUrl", e.target.value); if (e.target.value) { setPendingPhoto(null); setPreview(e.target.value); } }} />
          </label>
          <label className="sc-field" data-invalid={field("photoFocus")}>
            <span>{copy.photoFocus}</span>
            <input value={form.photoFocus} placeholder="50% 30%" onChange={(e) => set("photoFocus", e.target.value)} />
            <small>{copy.photoFocusHint}</small>
          </label>
        </div>
        <fieldset className="sc-fields-2 sc-links">
          <legend>{copy.links}</legend>
          <label className="sc-field" data-invalid={field("linkedin")}><span>{copy.linkedin}</span><input type="url" value={form.socials.linkedin} onChange={(e) => set("socials", { ...form.socials, linkedin: e.target.value })} /></label>
          <label className="sc-field" data-invalid={field("email")}><span>{copy.email}</span><input type="email" value={form.socials.email} onChange={(e) => set("socials", { ...form.socials, email: e.target.value })} /></label>
          <label className="sc-field" data-invalid={field("website")}><span>{copy.website}</span><input type="url" value={form.socials.website} onChange={(e) => set("socials", { ...form.socials, website: e.target.value })} /></label>
          <label className="sc-field" data-invalid={field("github")}><span>{copy.github}</span><input type="url" value={form.socials.github} onChange={(e) => set("socials", { ...form.socials, github: e.target.value })} /></label>
        </fieldset>
        <label className="sc-switch" data-on={form.isActive ? "" : undefined}>
          <input className="sc-sr" type="checkbox" checked={form.isActive} onChange={(e) => set("isActive", e.target.checked)} />
          <i />
          <span>{form.isActive ? copy.shown : copy.hiddenLabel}</span>
        </label>
        {error ? <p className="sc-error" role="alert">{error}</p> : null}
        <div className="sc-dialog-actions">
          <button type="button" className="rb-btn" onClick={onClose} disabled={locked}>{copy.cancel}</button>
          <button type="submit" className="rb-cta rb-cta-sm" disabled={locked}>{locked ? copy.saving : copy.save}</button>
        </div>
      </form>
    </dialog>
  );
}

function ConfirmDialog({ title, body, confirmLabel, cancelLabel, busy, onClose, onConfirm }: {
  title: string; body: string; confirmLabel: string; cancelLabel: string; busy: boolean; onClose: () => void; onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const onCancel = (event: Event) => { event.preventDefault(); onClose(); };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, [onClose]);
  return (
    <dialog ref={ref} className="sc-dialog" aria-labelledby="sc-del-title" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="sc-dialog-head">
        <h2 id="sc-del-title">{title}</h2>
        <button type="button" className="sc-iconbtn" onClick={onClose} aria-label={cancelLabel} disabled={busy}>{I("M6 6l12 12M18 6L6 18")}</button>
      </div>
      <div className="sc-form">
        <p className="sc-lead sc-confirm">{body}</p>
        <div className="sc-dialog-actions">
          <button type="button" className="rb-btn" onClick={onClose} disabled={busy}>{cancelLabel}</button>
          <button type="button" className="rb-cta rb-cta-sm sc-danger" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
        </div>
      </div>
    </dialog>
  );
}
