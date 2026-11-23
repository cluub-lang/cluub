// Shared message templates. The runtime uses them to report validation errors
// and the test generator uses them to know exactly which message to expect.
export const msg = {
  required: (f) => `${f} is required`,
  minText: (f, n) => `${f} must be at least ${n} characters`,
  maxText: (f, n) => `${f} must be at most ${n} characters`,
  minNumber: (f, n) => `${f} must be at least ${n}`,
  maxNumber: (f, n) => `${f} must be at most ${n}`,
  minList: (f, n) => `${f} must have at least ${n} items`,
  maxList: (f, n) => `${f} must have at most ${n} items`,
  oneOf: (f, list) => `${f} must be one of: ${list.join(', ')}`,
  type: (f, type, got) => `${f} must be ${article(type)} (got ${describe(got)})`,
  email: (f) => `${f} must be a valid email address`,
  url: (f) => `${f} must be a valid web address (https://...)`,
  date: (f) => `${f} must be a valid date like 2026-01-31`,
  unknownField: (model, f, hint) => `${model} has no field "${f}"${hint ? `. Did you mean "${hint}"?` : ''}`,
  missingParam: (p) => `Missing required value "${p}"`,
  notFound: (model, id) => `${model} "${id}" was not found`,
};

export function article(type) {
  const t = { text: 'text', number: 'number', bool: 'yes/no value', email: 'email', date: 'date', list: 'list', url: 'web address' }[type] || type;
  return /^[aeiou]/i.test(t) ? `an ${t}` : `a ${t}`;
}
export function describe(v) {
  if (v === null || v === undefined) return 'nothing';
  if (typeof v === 'string') return `"${v.length > 30 ? v.slice(0, 30) + '…' : v}"`;
  if (Array.isArray(v)) return 'a list';
  if (typeof v === 'object') return 'an object';
  return String(v);
}
