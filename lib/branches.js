// The three branches (สาขา). A task belongs to one branch, and so does every technician (set on their profile).
export const BRANCHES = [
  { value: 'rca', label: 'RCA' },
  { value: 'bn', label: 'BN' },
  { value: 'ck', label: 'CK' },
];
export const branchLabel = (v) => (BRANCHES.find((b) => b.value === v) || { label: '' }).label;
