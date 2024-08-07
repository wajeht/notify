import express from 'express';
import { catchAsyncErrorMiddleware } from './middleware';
import { getHealthzHandler, postNotificationHandler } from './handler';

const router = express.Router();

router.post('/', catchAsyncErrorMiddleware(postNotificationHandler()));

router.get('/healthz', catchAsyncErrorMiddleware(getHealthzHandler()));

export { router };
