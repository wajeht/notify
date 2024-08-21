type Params = {
	username: string;
	content: any;
	embeds?: any;
};

export async function sendDiscord(
	webhookUrl: string,
	message: string,
	details: Record<string, unknown> | null,
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

		const res = await fetch(webhookUrl, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(params),
		});

		if (res.status === 204) {
			console.info(`discord bot has sent: ${message}`);
		}
	} catch (error) {
		console.error('error sending discord notification:', error);
	}
}
