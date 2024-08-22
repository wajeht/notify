import { body } from 'express-validator';
import { db } from './db/db';
import { ValidationError } from './error';

export const postSettingsAccountHandlerValidator = [
	body('username')
		.notEmpty()
		.custom(async (username, { req }) => {
			const userId = req.session?.user?.id;

			const existingUser = await db
				.select('*')
				.from('users')
				.where('username', username)
				.whereNot('id', userId)
				.first();

			if (existingUser) {
				throw ValidationError('Username is already taken');
			}

			return true;
		}),
	body('email')
		.notEmpty()
		.isEmail()
		.custom(async (email, { req }) => {
			const userId = req.session?.user?.id;

			const existingUser = await db
				.select('*')
				.from('users')
				.where('email', email)
				.whereNot('id', userId)
				.first();

			if (existingUser) {
				throw ValidationError('Email is already in use');
			}

			return true;
		}),
];
