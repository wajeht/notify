import { app } from './app';
import { Server } from 'http';
import { AddressInfo } from 'net';
import { appConfig } from './config';
import { db, redis } from './db/db';
import { runMigrations } from './utils';
import { resetUserMonthlyAlertLimitJob } from './jobs/reset-user-monthly-alert-limit.job';

const server: Server = app.listen(appConfig.port);

server.on('listening', async () => {
	const addr: string | AddressInfo | null = server.address();
	// prettier-ignore
	const bind: string = typeof addr === 'string' ? 'pipe ' + addr : 'port ' + (addr as AddressInfo).port;

	console.info(`Server is listening on ${bind}`);

	if (appConfig.env === 'production') {
		await runMigrations();
	}

	// crons
	await resetUserMonthlyAlertLimitJob({}, { cron: '0 0 * * *' }); // daily at midnight
});

server.on('error', (error: NodeJS.ErrnoException) => {
	if (error.syscall !== 'listen') {
		throw error;
	}

	// prettier-ignore
	const bind: string = typeof appConfig.port === 'string' ? 'Pipe ' + appConfig.port : 'Port ' + appConfig.port;

	switch (error.code) {
		case 'EACCES':
			console.error(`${bind} requires elevated privileges`);
			process.exit(1);
		// eslint-disable-next-line no-fallthrough
		case 'EADDRINUSE':
			console.error(`${bind} is already in use`);
			process.exit(1);
		// eslint-disable-next-line no-fallthrough
		default:
			throw error;
	}
});

function gracefulShutdown(signal: string): void {
	console.info(`Received ${signal}, shutting down gracefully.`);

	server.close(async () => {
		console.info('HTTP server closed.');

		try {
			redis.quit();
			console.info('Redis connection closed.');
		} catch (error) {
			console.error('Error closing Redis connection:', error);
		}

		try {
			await db.destroy();
			console.info('Database connection closed.');
		} catch (error) {
			console.error('Error closing database connection:', error);
		}

		console.info('All connections closed successfully.');
		process.exit(0);
	});

	setTimeout(() => {
		console.error('Could not close connections in time, forcefully shutting down');
		process.exit(1);
	}, 10000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

process.on('uncaughtException', async (error: Error, origin: string) => {
	console.error('Uncaught Exception:', error, 'Origin:', origin);
	gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', async (reason: unknown, promise: Promise<unknown>) => {
	console.error('Unhandled Rejection:', promise, 'reason:', reason);
	gracefulShutdown('unhandledRejection');
});
