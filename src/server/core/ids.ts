import { isT1, isT3, type T1, type T3 } from '@devvit/web/shared';

/** Narrows a stored id to a post id, or fails loudly. */
export const postId = (id: string): T3 => {
  if (!isT3(id)) throw new Error(`Not a post id: ${id}`);
  return id;
};

/** Narrows a stored id to a comment id, or fails loudly. */
export const commentId = (id: string): T1 => {
  if (!isT1(id)) throw new Error(`Not a comment id: ${id}`);
  return id;
};

/** Where a comment can be posted: a post or another comment. */
export const thingId = (id: string): T1 | T3 => (isT1(id) ? id : postId(id));
