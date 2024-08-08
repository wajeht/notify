import express from 'express';
import { catchAsyncErrorMiddleware } from './middleware';
import { getHealthzHandler, postNotificationHandler } from 'handler';

const router = express.Router();

router.post('/', catchAsyncErrorMiddleware(getHealthzHandler));

router.get('/healthz', catchAsyncErrorMiddleware(postNotificationHandler));

export { router };
