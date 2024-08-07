type Params = {
	username: string;
	content: any;
	embeds?: any;
};

export async function send(
	discordWebhookUrl: string,
	message: string,
	details: any = null,
): Promise<void> {
	try {
		const params: Params = {
			username: 'notify.jaw.dev',
			content: message,
		};

		if (details) {
			params.embeds = [
				{
					title: message,
					description: JSON.stringify(details),
				},
			];
		}

		const res = await fetch(discordWebhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		});

		if (res.status === 204) {
			console.info(`Discord bot has sent: ${message}`);
		}
	} catch (error) {
		console.error('Error sending Discord notification:', error);
	}
}
