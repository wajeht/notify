import { Queue, Worker, Job } from 'bullmq';
import { redis } from '../db/db';

const queueName = 'sendNotificationQueue';

export const sendNotificationQueue = new Queue(queueName, {
	connection: redis,
});

export interface NotificationJobData {
	appId: string;
	message: string;
	details: any;
}

const processSendNotificationJob = async (job: Job<NotificationJobData>) => {
	try {
		await job.updateProgress(0);
		console.log(`Processing notification for app ${job.data.appId}: ${job.data.message}`);
		// do stuff
		await job.updateProgress(100);
	} catch (error) {
		console.error('Failed to send notification:', error);
		throw error;
	}
};

new Worker<NotificationJobData>(queueName, processSendNotificationJob, { connection: redis });

export async function sendNotificationJob(
	data: NotificationJobData,
): Promise<Job<NotificationJobData>> {
	try {
		return await sendNotificationQueue.add('sendNotificationJob', data);
	} catch (error) {
		console.error('Failed to add job to queue:', error);
		throw error;
	}
}
