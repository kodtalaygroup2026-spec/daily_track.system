// The three branches (สาขา). A task belongs to one branch, and so does every technician.
export const BRANCHES = [
  { value: 'rca', label: 'RCA' },
  { value: 'bn', label: 'BN' },
  { value: 'ck', label: 'CK' },
];
export const branchLabel = (v) => (BRANCHES.find((b) => b.value === v) || { label: '' }).label;

// which branch each technician works in (display names, as in the sample data)
export const TECH_BRANCH = {
  'สมชาย ป.': 'rca',
  'วิชัย ก.': 'rca',
  'ประเสริฐ ท.': 'rca',
  'อนุชา ส.': 'bn',
  'สุรชัย ม.': 'bn',
  'ธนากร พ.': 'bn',
  'ณัฐพล ว.': 'ck',
  'กิตติ ร.': 'ck',
};
