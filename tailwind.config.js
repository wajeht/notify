/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/views/**/*.{html,js}'],
	theme: {
		extend: {},
	},
	plugins: [require('@tailwindcss/typography'), require('daisyui')],
	daisyui: {
		themes: ['light'],
		logs: false,
	},
};
