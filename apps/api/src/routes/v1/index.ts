import { Router } from 'express';
import { clientsRouter } from './clients';
import { healthRouter } from './health';
import { inspectionsRouter } from './inspections';
import { meRouter } from './me';
import { projectsRouter } from './projects';
import { usersRouter } from './users';

export const v1Router = Router();

v1Router.use(healthRouter);
v1Router.use(meRouter);
v1Router.use('/clients', clientsRouter);
v1Router.use('/projects', projectsRouter);
v1Router.use('/inspections', inspectionsRouter);
v1Router.use('/users', usersRouter);

// Not yet implemented:
// v1Router.use('/attachments', attachmentsRouter);
// v1Router.use('/notes', notesRouter);
