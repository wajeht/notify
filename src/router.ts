import express from 'express';
import { catchAsyncErrorMiddleware } from './middleware';
import { getHealthzHandler } from './api/app.handler';
import { postNotificationHandler } from 'api/notification.handler';

const router = express.Router();

router.post('/', catchAsyncErrorMiddleware(postNotificationHandler()));

router.get('/healthz', catchAsyncErrorMiddleware(getHealthzHandler()));

export { router };
