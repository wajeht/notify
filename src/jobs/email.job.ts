import { Queue, Worker } from 'bullmq';
import { redis } from '../db/db';
// import { sendEmail } from './channel/email';

const queueName = 'sendEmailQueue';

export const sendEmailQueue = new Queue(queueName, {
	connection: redis,
});

const processSendEmailJob = async (job: any) => {
	try {
		job.updateProgress(0);
		// await sendEmail({ tenant: job.data.tenant, coach: job.data.coach });
		job.updateProgress(100);
		console.info(`Email successfully sent for tenant: ${job.data.tenant}`);
	} catch (error) {
		console.error(`Failed to send email for tenant: ${job.data.tenant}`, error);
	}
};

new Worker(queueName, processSendEmailJob, { connection: redis });

export async function sendApproveTenantEmailJob(data: any) {
	try {
		await sendEmailQueue.add('sendEmailJob', data);
	} catch (error) {
		console.error(`Failed to add job to queue for tenant: ${data.tenant}`, error);
	}
}
