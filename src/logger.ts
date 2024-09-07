import pino from 'pino';
import path from 'node:path';
import pretty from 'pino-pretty';

export const logger = pino(
	{
		level: process.env.PINO_LOG_LEVEL || 'info',
		formatters: {
			level: (label) => ({ level: label }),
		},
		timestamp: pino.stdTimeFunctions.isoTime,
	},
	pino.multistream([
		{
			stream: pino.destination(
				`${path.resolve(process.cwd())}/logs/${new Date().toISOString().split('T')[0]}.log`,
			),
		},
		{
			stream: pretty({
				translateTime: 'yyyy-mm-dd HH:MM:ss TT',
				colorize: true,
				ignore: 'hostname,pid',
			}),
		},
	]),
);
