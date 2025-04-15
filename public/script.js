/**
 * Initializes details element functionality for all details elements on the page
 */
function initializeDetailsElements() {
	// Get all details elements on the page
	const detailsElements = document.querySelectorAll('details');

	if (detailsElements.length > 0) {
		// For each details element
		detailsElements.forEach((detailsElement) => {
			// Event listener for opening this details element
			detailsElement.addEventListener('toggle', function (_event) {
				// If this details element was just opened
				if (this.hasAttribute('open')) {
					// Close all other details elements
					detailsElements.forEach((otherDetails) => {
						if (otherDetails !== this && otherDetails.hasAttribute('open')) {
							otherDetails.removeAttribute('open');
						}
					});
				}
			});
		});

		// Document-level click handler to close all details when clicking outside
		document.addEventListener('click', function (event) {
			// Check if the click was inside any details element
			let clickedInsideAnyDetails = false;

			detailsElements.forEach((details) => {
				if (event.target instanceof Node && details.contains(event.target)) {
					clickedInsideAnyDetails = true;
				}
			});

			// If clicked outside all details elements, close any open ones
			if (!clickedInsideAnyDetails) {
				detailsElements.forEach((details) => {
					if (details.hasAttribute('open')) {
						details.removeAttribute('open');
					}
				});
			}
		});
	}
}

document.addEventListener('DOMContentLoaded', () => {
	initializeDetailsElements();
});
