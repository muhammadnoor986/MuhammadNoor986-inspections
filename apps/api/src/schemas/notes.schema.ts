import { z } from 'zod';
import { paginationQuerySchema } from './common.schema';

export const notesListQuerySchema = paginationQuerySchema.pick({ page: true, pageSize: true, sortDir: true });

export const createNoteSchema = z.object({
  body: z.string().min(1).max(5000),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type NotesListQuery = z.infer<typeof notesListQuerySchema>;
