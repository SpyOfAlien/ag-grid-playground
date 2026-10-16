export class RevisionConflictError extends Error {
  constructor(message = 'Revision conflict. Reload the current data and review the draft.') {
    super(message);
    this.name = 'RevisionConflictError';
  }
}
