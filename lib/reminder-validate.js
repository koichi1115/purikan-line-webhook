'use strict';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,100}$/;
const DAY_MS = 86400000;

function optString(v, max) {
  if (v === undefined || v === null || v === '') return { ok: true, value: null };
  return typeof v === 'string' && v.length <= max ? { ok: true, value: v } : { ok: false };
}

function jstToday() {
  return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
}

function validDueDate(v) {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== v) return false;
  const diffDays = (t - Date.parse(`${jstToday()}T00:00:00Z`)) / DAY_MS;
  return diffDays >= -1 && diffDays <= 366;
}

/**
 * Validate POST /api/reminder body. lineUserId in the body is ignored on purpose.
 * Returns { ok: true, value } or { ok: false, field }.
 */
function validateReminder(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, field: 'body' };
  const { title, dueDate, type } = body;
  if (typeof title !== 'string' || title.length < 1 || title.length > 200) return { ok: false, field: 'title' };
  if (!validDueDate(dueDate)) return { ok: false, field: 'dueDate' };
  if (type !== 'todo' && type !== 'item') return { ok: false, field: 'type' };
  const daysBefore = body.daysBefore === undefined || body.daysBefore === null ? 1 : body.daysBefore;
  if (!Number.isInteger(daysBefore) || daysBefore < 0 || daysBefore > 30) return { ok: false, field: 'daysBefore' };
  const targetPerson = optString(body.targetPerson, 50);
  if (!targetPerson.ok) return { ok: false, field: 'targetPerson' };
  const documentTitle = optString(body.documentTitle, 200);
  if (!documentTitle.ok) return { ok: false, field: 'documentTitle' };
  const driveFileId = optString(body.driveFileId, 100);
  if (!driveFileId.ok || (driveFileId.value && !DRIVE_ID_RE.test(driveFileId.value))) return { ok: false, field: 'driveFileId' };
  return {
    ok: true,
    value: { title, dueDate, type, daysBefore, targetPerson: targetPerson.value, documentTitle: documentTitle.value, driveFileId: driveFileId.value },
  };
}

module.exports = { validateReminder };
