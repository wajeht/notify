import express from 'express';
import { catchAsyncErrorMiddleware } from './middleware';
import { getHealthzHandler, postNotificationHandler, getHomePageHandler } from './handler';

const router = express.Router();

router.get('/', catchAsyncErrorMiddleware(getHomePageHandler));

router.post('/', catchAsyncErrorMiddleware(postNotificationHandler));

router.get('/healthz', catchAsyncErrorMiddleware(getHealthzHandler));

export { router };
