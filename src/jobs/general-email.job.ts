export interface GeneralEmailJobData {
	email: string;
	subject: string;
	username: string;
	message: string;
}

export { sendGeneralEmail } from '../utils';
