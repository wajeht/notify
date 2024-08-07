async function main() {
	try {
		const response = await fetch('http://localhost', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-API-Key': '42069247355',
			},
			body: JSON.stringify({
				id: 69,
				message: 'Hello, this is a test message',
				details: {
					name: 'John Doe',
					age: 30,
					email: 'john.doe@example.com',
				},
			}),
		});

		const data = await response.json();
		console.log(data);
	} catch (error) {
		console.error('Error:', error);
	}
}

main();
