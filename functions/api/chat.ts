import type { Env } from '../_lib/types';
import { handleCompletion } from '../_lib/completionHandler';

/** POST /api/chat — alias de /api/chat/completions. */
export const onRequestPost: PagesFunction<Env> = (context) => handleCompletion(context);
