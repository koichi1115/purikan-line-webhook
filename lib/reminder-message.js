'use strict';

function groupBy(items, keyFn) {
  const out = {};
  for (const item of items) (out[keyFn(item)] ||= []).push(item);
  return out;
}

function formatSection(label, items) {
  if (items.length === 0) return '';
  return `\n\n${label}` + items.map((i) => `\n  - 【${i.targetPerson}】${i.title} (期限: ${i.dueDate})`).join('');
}

/** Build the grouped LINE text for one user's reminders. */
function buildReminderMessage(items) {
  let message = '⏰ リマインダー\n';
  for (const [docTitle, docItems] of Object.entries(groupBy(items, (i) => i.documentTitle || '(資料名なし)'))) {
    message += `\n📄 ${docTitle}`;
    const driveFileId = docItems[0].driveFileId;
    if (driveFileId) message += `\n📎 https://drive.google.com/open?id=${driveFileId}`;
    message += formatSection('✔️ TODO:', docItems.filter((i) => i.type === 'todo'));
    message += formatSection('🎒 持ち物:', docItems.filter((i) => i.type === 'item'));
    message += '\n';
  }
  return message;
}

module.exports = { buildReminderMessage, groupBy };
