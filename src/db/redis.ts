import Redis from 'ioredis';
import { logger } from '../logger';
import RedisMock from 'ioredis-mock';
import { appConfig, redisConfig } from '../config';

function _createRedisClient() {
	const redisOptions = {
		port: redisConfig.port,
		host: redisConfig.host,
		password: redisConfig.password,
		maxRetriesPerRequest: null,
		family: 0, // Support both IPv6 and IPv4
	};

	let client: Redis | typeof RedisMock;

	if (appConfig.env === 'testing') {
		client = new RedisMock(redisOptions);
		logger.info('Redis mock client created for testing');
	} else {
		client = new Redis(redisOptions);
	}

	client.on('ready', () => {
		logger.info('Redis connection established successfully');
	});

	client.on('error', (error) => {
		logger.error('Error initializing Redis:', error);
		process.exit(1);
	});

	return client;
}

export const redis = _createRedisClient();
