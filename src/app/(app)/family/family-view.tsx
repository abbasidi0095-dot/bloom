"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Baby as BabyIcon,
  Check,
  Copy,
  Crown,
  Loader2,
  Mail,
  Pencil,
  Plus,
  Shield,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useBaby } from "@/components/baby-provider";
import { useT } from "@/i18n/provider";
import { useToast } from "@/components/providers";
import { Avatar, EmptyState, Field, PageHeader, Segmented, Sheet } from "@/components/ui";
import { apiFetch, ApiClientError, uploadImage } from "@/lib/client";
import { formatDate } from "@/lib/format";
import type { Baby } from "@/lib/family";

type Role = "parent" | "caregiver" | "viewer";

export function FamilyView() {
  const { family, baby, role, canManage, canWrite, timezone, locale } = useBaby();
  const { t } = useT();
  const toast = useToast();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [babyOpen, setBabyOpen] = useState(false);
  const [editing, setEditing] = useState<Baby | null>(null);
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("parent");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteResult, setInviteResult] = useState<{ link: string; code: string; delivered: boolean } | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [familyName, setFamilyName] = useState(family.name);

  const [babyName, setBabyName] = useState("");
  const [dob, setDob] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [sex, setSex] = useState<"female" | "male" | "unspecified">("unspecified");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [head, setHead] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [pediatrician, setPediatrician] = useState("");
  const [allergies, setAllergies] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const familyQuery = useQuery({
    queryKey: ["family", family.id],
    queryFn: () =>
      apiFetch<{
        family: { id: string; name: string; owner_id: string };
        members: Array<{ id: string; role: string; user_id: string; name: string; email: string; avatar_url: string | null; joined_at: string }>;
        invitations: Array<{ id: string; email: string; role: string; expires_at: string; accepted_at: string | null }>;
      }>(`/api/family?familyId=${family.id}`),
  });

  const data = familyQuery.data;

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await apiFetch<{ link: string; invitation: { code: string }; delivered: boolean }>("/api/family/invitations", {
        method: "POST",
        json: { familyId: family.id, email, role: inviteRole },
      });
      setInviteResult({ link: result.link, code: result.invitation.code, delivered: result.delivered });
      setEmail("");
      toast(t("family.inviteSent"));
      void queryClient.invalidateQueries({ queryKey: ["family", family.id] });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("family.inviteError"));
    } finally {
      setLoading(false);
    }
  }

  async function revoke(id: string) {
    await apiFetch(`/api/family/invitations/${id}`, { method: "DELETE" });
    toast(t("family.inviteRevoked"));
    void queryClient.invalidateQueries({ queryKey: ["family", family.id] });
  }

  async function changeRole(id: string, nextRole: Role) {
    try {
      await apiFetch(`/api/family/members/${id}`, { method: "PATCH", json: { role: nextRole } });
      toast(t("settings.savedChanges"));
      void queryClient.invalidateQueries({ queryKey: ["family", family.id] });
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : t("common.error"), { tone: "error" });
    }
  }

  async function removeMember(id: string, name: string) {
    if (!window.confirm(t("family.removeConfirm", { name }))) return;
    try {
      await apiFetch(`/api/family/members/${id}`, { method: "DELETE" });
      toast(t("family.memberRemoved"));
      void queryClient.invalidateQueries({ queryKey: ["family", family.id] });
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : t("common.error"), { tone: "error" });
    }
  }

  async function rename() {
    setLoading(true);
    try {
      await apiFetch("/api/family", { method: "PATCH", json: { familyId: family.id, name: familyName } });
      setRenaming(false);
      toast(t("settings.savedChanges"));
      router.refresh();
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : t("common.error"), { tone: "error" });
    } finally {
      setLoading(false);
    }
  }

  function openBaby(item?: Baby) {
    setEditing(item ?? null);
    setBabyName(item?.first_name ?? "");
    setDob(item?.date_of_birth ?? "");
    setBirthTime(item?.birth_time?.slice(0, 5) ?? "");
    setSex((item?.sex as typeof sex) ?? "unspecified");
    setWeight(item?.birth_weight_g ? String(item.birth_weight_g / 1000) : "");
    setHeight(item?.birth_height_cm ? String(item.birth_height_cm) : "");
    setHead(item?.head_circumference_cm ? String(item.head_circumference_cm) : "");
    setBloodType(item?.blood_type ?? "");
    setPediatrician(item?.pediatrician_name ?? "");
    setAllergies(item?.allergies ?? "");
    setNotes(item?.notes ?? "");
    setPhotoUrl(item?.photo_url ?? "");
    setError("");
    setBabyOpen(true);
  }

  async function deleteBaby() {
    if (!editing) return;
    if (!window.confirm(t("family.deleteBabyConfirm", { name: editing.first_name }))) return;
    try {
      await apiFetch(`/api/babies/${editing.id}`, { method: "DELETE" });
      toast(t("common.deleted"));
      setBabyOpen(false);
      router.refresh();
      void queryClient.invalidateQueries({ queryKey: ["family", family.id] });
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : t("common.error"), { tone: "error" });
    }
  }

  async function saveBaby(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = {
        firstName: babyName,
        dateOfBirth: dob,
        birthTime: birthTime || null,
        sex,
        birthWeightG: weight ? Math.round(Number(weight) * 1000) : null,
        birthHeightCm: height ? Number(height) : null,
        headCircumferenceCm: head ? Number(head) : null,
        bloodType: bloodType || null,
        pediatricianName: pediatrician || null,
        allergies: allergies || null,
        notes: notes || null,
        photoUrl: photoUrl || null,
      };
      if (editing) {
        await apiFetch(`/api/babies/${editing.id}`, { method: "PATCH", json: payload });
      } else {
        await apiFetch("/api/babies", { method: "POST", json: { ...payload, familyId: family.id } });
      }
      toast(t("common.saved"));
      setBabyOpen(false);
      router.refresh();
      void queryClient.invalidateQueries({ queryKey: ["family", family.id] });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  async function upload(file: File | null) {
    if (!file || !baby || !editing) return;
    setUploading(true);
    try {
      const result = await uploadImage(file, editing.id);
      setPhotoUrl(result.url);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : t("common.error"));
    } finally {
      setUploading(false);
    }
  }

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    toast(t("common.copied"));
  }

  return (
    <div className="animate-fade-up">
      <PageHeader
        kicker={t("nav.family")}
        title={t("family.title")}
        subtitle={t("family.subtitle")}
        action={
          canManage ? (
            <button type="button" className="btn btn-primary" onClick={() => { setInviteOpen(true); setInviteResult(null); }}>
              <Mail size={16} />
              {t("family.inviteMember")}
            </button>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <section className="card card-pad">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="section-title">{t("family.members")}</h2>
            <span className="chip">{family.name}</span>
          </div>

          {renaming ? (
            <div className="mb-4 flex gap-2">
              <input className="input" value={familyName} onChange={(event) => setFamilyName(event.target.value)} maxLength={80} />
              <button type="button" className="btn btn-primary btn-sm" onClick={rename} disabled={loading}>
                {t("common.save")}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRenaming(false)}>
                {t("common.cancel")}
              </button>
            </div>
          ) : canManage ? (
            <button type="button" className="mb-4 text-[11px] font-bold text-accent-strong underline underline-offset-2" onClick={() => setRenaming(true)}>
              {t("family.renameFamily")}
            </button>
          ) : null}

          <ul className="divide-y divide-line">
            {(data?.members ?? []).map((member) => (
              <li key={member.id} className="flex items-center gap-3 py-3">
                <Avatar src={member.avatar_url} name={member.name} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-bold">
                    {member.name}
                    {member.role === "owner" ? <Crown size={13} className="text-gold" /> : null}
                  </div>
                  <div className="text-[11px] text-muted">
                    {member.email} · {t(`common.${member.role}`)}
                  </div>
                </div>
                {role === "owner" && member.role !== "owner" ? (
                  <>
                    <select
                      className="select !min-h-[34px] !w-auto !rounded-full !py-0.5 !ps-2 !pe-6 text-[10px] font-bold"
                      value={member.role}
                      aria-label={t("family.inviteRole")}
                      onChange={(event) => changeRole(member.id, event.target.value as Role)}
                    >
                      <option value="parent">{t("common.parent")}</option>
                      <option value="caregiver">{t("common.caregiver")}</option>
                      <option value="viewer">{t("common.viewer")}</option>
                    </select>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon text-muted"
                      aria-label={t("family.removeMember")}
                      onClick={() => removeMember(member.id, member.name)}
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>

          {(data?.invitations?.length ?? 0) > 0 ? (
            <div className="mt-5">
              <h3 className="section-title mb-2">{t("family.pendingInvites")}</h3>
              <ul className="space-y-2">
                {data!.invitations.map((invite) => (
                  <li key={invite.id} className="flex items-center gap-2 rounded-[14px] border border-line bg-surface p-2.5">
                    <Mail size={14} className="text-muted" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-bold">{invite.email}</div>
                      <div className="text-[10px] text-muted">
                        {t(`common.${invite.role}`)} · {formatDate(invite.expires_at, locale, timezone)}
                      </div>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => revoke(invite.id)}>
                      {t("common.revoke")}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="mt-4 text-[10px] leading-relaxed text-muted">{t("family.roleHint")}</p>
        </section>

        <section className="card card-pad">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="section-title">{t("family.babiesInFamily")}</h2>
            {canManage ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => openBaby()}>
                <Plus size={14} />
                {t("common.addBaby")}
              </button>
            ) : null}
          </div>
          {family.babies.length ? (
            <ul className="space-y-2">
              {family.babies.map((item) => (
                <li key={item.id} className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3">
                  <Avatar src={item.photo_url} name={item.first_name} size={48} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">{item.first_name} {item.last_name ?? ""}</div>
                    <div className="text-[11px] text-muted">
                      {formatDate(item.date_of_birth, locale, timezone, "D MMMM YYYY")} · {item.sex}
                    </div>
                  </div>
                  {canManage ? (
                    <button type="button" className="btn btn-ghost btn-icon" onClick={() => openBaby(item)} aria-label={t("family.editBaby")}>
                      <Pencil size={15} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<BabyIcon size={20} />} title={t("family.noBabies")} action={canManage ? <button type="button" className="btn btn-primary btn-sm" onClick={() => openBaby()}>{t("common.addBaby")}</button> : null} />
          )}
        </section>
      </div>

      <Sheet open={inviteOpen} onClose={() => setInviteOpen(false)} title={t("family.inviteMember")} subtitle={t("family.inviteHint")}>
        {inviteResult ? (
          <div className="space-y-4">
            <div className="rounded-[18px] border border-line bg-sage-soft p-4">
              <p className="text-xs font-bold">{t("family.inviteLink")}</p>
              <div className="mt-2 flex items-center gap-2">
                <input readOnly className="input text-xs" value={inviteResult.link} />
                <button type="button" className="btn btn-secondary btn-icon" onClick={() => copy(inviteResult.link)} aria-label={t("common.copy")}>
                  <Copy size={15} />
                </button>
              </div>
              <p className="mt-3 text-xs font-bold">{t("family.inviteCode")}</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="rounded-[10px] bg-surface px-3 py-2 text-lg font-bold tracking-[0.2em]">{inviteResult.code}</code>
                <button type="button" className="btn btn-secondary btn-icon" onClick={() => copy(inviteResult.code)} aria-label={t("common.copy")}>
                  <Copy size={15} />
                </button>
              </div>
              {!inviteResult.delivered ? <p className="mt-2 text-[10px] text-muted">{t("auth.smtpMissing")}</p> : null}
              <p className="mt-2 text-[10px] text-muted">{t("family.inviteHint")}</p>
            </div>
            <button type="button" className="btn btn-secondary w-full" onClick={() => setInviteResult(null)}>
              {t("family.inviteMember")}
            </button>
          </div>
        ) : (
          <form onSubmit={invite} className="space-y-4">
            {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}
            <Field label={t("family.inviteByEmail")}>
              <input type="email" className="input" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="partner@example.com" />
            </Field>
            <Field label={t("family.inviteRole")}>
              <Segmented
                value={inviteRole}
                onChange={setInviteRole}
                options={[
                  { value: "parent", label: t("common.parent") },
                  { value: "caregiver", label: t("common.caregiver") },
                  { value: "viewer", label: t("common.viewer") },
                ]}
              />
            </Field>
            <button type="submit" className="btn btn-primary btn-lg w-full" disabled={loading}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Mail size={17} />}
              {t("family.sendInvite")}
            </button>
          </form>
        )}
      </Sheet>

      <Sheet open={babyOpen} onClose={() => setBabyOpen(false)} title={editing ? t("family.editBaby") : t("family.addBaby")} subtitle={t("family.profile")} size="wide">
        <form onSubmit={saveBaby} className="space-y-4">
          {error ? <div className="rounded-[14px] bg-peach-soft p-3 text-sm">{error}</div> : null}
          <div className="flex items-center gap-4">
            <Avatar src={photoUrl} name={babyName || "B"} size={64} />
            {editing ? (
              <label className="btn btn-secondary btn-sm cursor-pointer">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                {t("family.photo")}
                <input type="file" accept="image/*" className="hidden" onChange={(event) => upload(event.target.files?.[0] ?? null)} />
              </label>
            ) : (
              <span className="text-[10px] text-muted">{t("onboarding.photo")} · {t("common.optional")}</span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label={t("onboarding.babyName")}>
              <input className="input" value={babyName} onChange={(event) => setBabyName(event.target.value)} required maxLength={60} />
            </Field>
            <Field label={t("onboarding.dob")}>
              <input type="date" className="input" value={dob} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setDob(event.target.value)} required />
            </Field>
            <Field label={t("onboarding.birthTime")}>
              <input type="time" className="input" value={birthTime} onChange={(event) => setBirthTime(event.target.value)} />
            </Field>
          </div>
          <Field label={t("onboarding.sex")}>
            <Segmented
              value={sex}
              onChange={setSex}
              options={[
                { value: "female", label: t("onboarding.sexFemale") },
                { value: "male", label: t("onboarding.sexMale") },
                { value: "unspecified", label: t("onboarding.sexUnspecified") },
              ]}
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label={`${t("growth.weight")} (kg)`}>
              <input type="number" step="0.01" className="input" value={weight} onChange={(event) => setWeight(event.target.value)} />
            </Field>
            <Field label={`${t("growth.height")} (cm)`}>
              <input type="number" step="0.1" className="input" value={height} onChange={(event) => setHeight(event.target.value)} />
            </Field>
            <Field label={`${t("growth.head")} (cm)`}>
              <input type="number" step="0.1" className="input" value={head} onChange={(event) => setHead(event.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("family.allergies")}>
              <input className="input" value={allergies} onChange={(event) => setAllergies(event.target.value)} />
            </Field>
            <Field label={t("health.pediatrician")}>
              <input className="input" value={pediatrician} onChange={(event) => setPediatrician(event.target.value)} />
            </Field>
          </div>
          <Field label={t("common.notes")}>
            <textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000} />
          </Field>
          <div className="flex items-center gap-2">
            {editing ? (
              <button type="button" className="btn btn-danger" onClick={deleteBaby}>
                <Trash2 size={15} />
                {t("common.delete")}
              </button>
            ) : null}
            <button type="submit" className="btn btn-primary btn-lg flex-1" disabled={loading}>
              {loading ? <Loader2 size={18} className="animate-spin" /> : <Check size={17} />}
              {t("common.save")}
            </button>
          </div>
        </form>
      </Sheet>
    </div>
  );
}
