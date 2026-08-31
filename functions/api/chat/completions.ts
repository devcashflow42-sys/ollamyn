import type { Env } from '../../_lib/types';
import { handleCompletion } from '../../_lib/completionHandler';

/** POST /api/chat/completions — generación de IA (JSON o streaming SSE). */
export const onRequestPost: PagesFunction<Env> = (context) => handleCompletion(context);
