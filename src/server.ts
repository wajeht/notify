import { app } from './app';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { appConfig } from './config';
import { db, redis } from './db/db';
import { runMigrations } from './utils';
import { logger } from './logger';
import { resetUserMonthlyAlertLimitJob } from './jobs/reset-user-monthly-alert-limit.job';
import { deleteExpiredExportJob } from './jobs/delete-expired-export.job';

const server: Server = app.listen(appConfig.port);

server.on('listening', async () => {
	const addr: string | AddressInfo | null = server.address();
	// prettier-ignore
	const bind: string = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + (addr as AddressInfo).port;

	logger.info(`Server is listening on ${bind}`);

	if (appConfig.env === 'production') {
		await runMigrations();
	}

	// crons
	await resetUserMonthlyAlertLimitJob({}, { cron: '0 0 * * *' }); // daily at midnight
	await deleteExpiredExportJob({}, { cron: '0 0 * * *' }); // daily at midnight
});

server.on('error', (error: NodeJS.ErrnoException) => {
	if (error.syscall !== 'listen') {
		throw error;
	}

	// prettier-ignore
	const bind: string = typeof appConfig.port === 'string' ? 'Pipe ' + appConfig.port : 'Port ' + appConfig.port;

	switch (error.code) {
		case 'EACCES':
			logger.error(`${bind} requires elevated privileges`);
			process.exit(1);
		// eslint-disable-next-line no-fallthrough
		case 'EADDRINUSE':
			logger.error(`${bind} is already in use`);
			process.exit(1);
		// eslint-disable-next-line no-fallthrough
		default:
			throw error;
	}
});

function gracefulShutdown(signal: string): void {
	logger.info(`Received ${signal}, shutting down gracefully.`);

	server.close(async () => {
		logger.info('HTTP server closed.');

		try {
			redis.quit();
			logger.info('Redis connection closed.');
		} catch (error) {
			logger.error('Error closing Redis connection:', error);
		}

		try {
			await db.destroy();
			logger.info('Database connection closed.');
		} catch (error) {
			logger.error('Error closing database connection:', error);
		}

		logger.info('All connections closed successfully.');
		process.exit(0);
	});

	setTimeout(() => {
		logger.error('Could not close connections in time, forcefully shutting down');
		process.exit(1);
	}, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

process.on('uncaughtException', async (error: Error, origin: string) => {
	logger.error('Uncaught Exception:', error, 'Origin:', origin);
	gracefulShutdown('uncaughtException');
});

process.on('warning', (warning: Error) => {
	logger.warn('Process warning:', warning.name, warning.message);
	gracefulShutdown('warning');
});

process.on('unhandledRejection', async (reason: unknown, promise: Promise<unknown>) => {
	logger.error('Unhandled Rejection:', promise, 'reason:', reason);
	gracefulShutdown('unhandledRejection');
});
