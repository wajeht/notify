import Redis from 'ioredis';
import RedisMock from 'ioredis-mock';
import { redisConfig } from '../config';

const redisOptions = {
	port: redisConfig.port,
	host: redisConfig.host,
	password: redisConfig.password,
	maxRetriesPerRequest: null,
	family: 0, // Support both IPv6 and IPv4
};

const createRedisClient = () => {
	if (process.env.APP_ENV === 'testing') {
		return new RedisMock(redisOptions);
	}
	return new Redis(redisOptions);
};

const redis = createRedisClient();

redis.on('ready', () => {
	console.log('Redis connection established successfully');
});

redis.on('error', (error) => {
	console.error('Error initializing Redis:', error);
	process.exit(1);
});

export { redis };
