// Every runtime error carries an HTTP status and a plain-English message.
export class CluubRuntimeError extends Error {
  constructor(message, status = 500, extra = {}) {
    super(message);
    this.status = status;
    Object.assign(this, extra);
  }
  toJSON() { return { message: this.message, code: this.code, ...(this.field ? { field: this.field } : {}) }; }
}
export class ValidationError extends CluubRuntimeError {
  constructor(message, field) { super(message, 400, { code: 'invalid', field }); this.name = 'ValidationError'; }
}
export class Fail extends CluubRuntimeError {
  constructor(message, status = 400) { super(String(message), status, { code: status === 404 ? 'not_found' : status === 403 ? 'forbidden' : 'failed' }); this.name = 'Fail'; }
}
export class NotFound extends CluubRuntimeError {
  constructor(message) { super(message, 404, { code: 'not_found' }); this.name = 'NotFound'; }
}
export class NetworkError extends CluubRuntimeError {
  constructor(message) { super(message, 502, { code: 'network' }); this.name = 'NetworkError'; }
}
export class AIError extends CluubRuntimeError {
  constructor(message) { super(message, 502, { code: 'ai' }); this.name = 'AIError'; }
}
// A feature needs the end user's own AI key and none was sent (shown to users: 401).
export class AIKeyRequired extends CluubRuntimeError {
  constructor(message) { super(message, 401, { code: 'ai_key_required' }); this.name = 'AIKeyRequired'; }
}
export class ApiError extends CluubRuntimeError {
  constructor(message, status, body) { super(message, status, { code: body?.error?.code || 'api', field: body?.error?.field }); this.name = 'ApiError'; }
}

// What `catch problem` gives Cluub code: problem.message, problem.status, problem.field
export function toError(e) {
  if (e instanceof CluubRuntimeError) return e;
  const err = new CluubRuntimeError(e?.message || String(e), 500, { code: 'internal' });
  err.cause = e;
  return err;
}
