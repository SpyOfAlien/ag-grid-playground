import { DirectBinding } from '../../../shared/table-system/interactions/direct-binding';
import { canReview } from '../domain/lab-operations';
import { ReviewContext } from './review-cell';
export function bindReview(context: ReviewContext, id: string) {
  const controller = context.controller;
  return new DirectBinding(
    controller,
    context.review,
    { entityId: id, operation: 'review' },
    () => canReview(controller.model, id),
    () => {
      const row = controller.model.lookup(id)!;
      return { id, reviewed: !row.reviewed, baseRevision: row.revision };
    },
  );
}
