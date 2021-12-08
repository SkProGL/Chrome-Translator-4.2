console.log("[content.js] - Translator4.2");

const API_KEY = "",
	XHR = new XMLHttpRequest();
XHR.withCredentials = true;

var previousText = '',
	canTranslate,
	reqFinished,
	targetLanguage = 'en',
	sourceLanguage = '',
	isAutodetectionEnabled = true,
	isLastSent,
	[translatedBlocks, detectedBlocks, coords] = [[], [], []];

const bubbleDOM = document.createElement('div').appendChild(document.createElement('div'));
bubbleDOM.setAttribute('class', 'tooltip_bubble');

// No need for css file if you want to prevent cases
// when website has the same class name or id and css file being applied automatically
cssProperties(bubbleDOM, {
	"font-family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
	"font-family": "monospace",
	"visibility": "hidden",
	"font-style": "normal",
	"position": "fixed",
	"padding": "12px",
	"margin": "1em 0 3em",
	"color": "rgb(205, 205, 205)",
	"background": "#3f3e3e",
	"z-index": "1000",
	"-webkit-border-radius": "10px",
	"-moz-border-radius": "10px",
	"border-radius": "-50%"
});
document.body.appendChild(bubbleDOM);

// on tooltip hover
var delay = function (elem, callback) {
	var timeout = null;
	elem.onmouseover = function () {
		// Set timeout to be a timer which will invoke callback
		timeout = setTimeout(callback, 3000);
	};

	elem.onmouseout = function () {
		// Clear any timers set to timeout
		clearTimeout(timeout);
	}
};


delay(document.getElementsByClassName('tooltip_bubble')[0], function () {
	// hide tooltip
	// bubbleDOM.style.visibility = 'hidden';
	copyToClipboard(previousText);
	let h=bubbleDOM.innerHTML;
	bubbleDOM.innerHTML='[COPIED TO CLIPBOARD]'
	let timeout = null;
	clearTimeout(timeout);
	timeout = setTimeout(function () {
		bubbleDOM.innerHTML=h;
	}, 600);
});
sendBackground('deserialize data');

// chrome Message passing is used to communicate with background and popup .js
// listener
chrome.extension.onMessage.addListener((request) => {
	// extension state (either on or off)
	console.log(request.content, request.action);
	if (request.action === 'remember everything') {
		canTranslate = (request.content['extensionState'] === "OFF") ? false : true;
		// console.log(canTranslate);
		targetLanguage = request.content['langTo']
		if (request.content['langFrom'] === 'auto') {
			sourceLanguage = '';
			isAutodetectionEnabled = true;
		} else {
			sourceLanguage = 'from=' + request.content['langFrom'] + '&';
			isAutodetectionEnabled = false;
		}
	}
});


// chrome Message passing is used to communicate with background and popup .js
// sender
function sendBackground(a = '', c = '') {
	chrome.runtime.sendMessage({
		target: 'background',
		action: a,
		content: c
	})
}

function showTranslation(mouseX, mouseY, input) {
	sendBackground('clipboard', input)
	previousText = input;
	if (isAutodetectionEnabled) {
		bubbleDOM.innerHTML = `${input}<div><small><em>Autodetected ${detectedBlocks}`
		bubbleDOM.getElementsByTagName('em')[0].style = 'color:rgb(172, 172, 172);'
	} else
		bubbleDOM.innerHTML = input
	bubbleDOM.style.visibility = 'visible';
	bubbleDOM.style.left = mouseX + 'px';
	bubbleDOM.style.top = mouseY + 'px';

}
// API request
function apiRequest(text) {
	XHR.open("POST", "https://microsoft-translator-text.p.rapidapi.com/translate?to=" + targetLanguage + "&api-version=3.0&" + sourceLanguage + "profanityAction=NoAction&textType=plain");
	XHR.setRequestHeader("content-type", "application/json");
	XHR.setRequestHeader("x-rapidapi-key", API_KEY);
	XHR.setRequestHeader("x-rapidapi-host", "microsoft-translator-text.p.rapidapi.com");
	XHR.send(JSON.stringify([{
		"text": text
	}]));
}
// API response
XHR.addEventListener("readystatechange", async function () {
	if (this.readyState === this.DONE) {
		const responseData = JSON.parse(this.responseText)[0];

		let detectedLanguage = responseData.detectedLanguage && responseData.detectedLanguage.language || [],
			// accuracy = responseData.detectedLanguage && responseData.detectedLanguage.score || [],
			translation = responseData.translations[0].text;

		if (reqFinished && reqFinished.length > 0) {
			translatedBlocks += translation
			if (!detectedBlocks.includes(detectedLanguage) && detectedLanguage !== []) {
				detectedBlocks.push(detectedLanguage)
			}

			showTranslation(coords[0], coords[1], translatedBlocks);
			// Last response received
			if (reqFinished.indexOf(false) === reqFinished.length - 1) {
				[translatedBlocks, detectedBlocks] = [[], []];
			}

			// Requests aborted
			if (reqFinished.indexOf(false) === -1) {
				// console.log('Aborted');
				[reqFinished, translatedBlocks, detectedBlocks] = [[], [], []];
				return;
			}
			reqFinished[reqFinished.indexOf(false)] = true

		} else {
			if (isLastSent === true) {
				isLastSent = false;
				return;
			}
			detectedBlocks.push(detectedLanguage)
			showTranslation(coords[0], coords[1], translation);
			detectedBlocks = [];
		}
	}
});

window.addEventListener('wheel', function () {
	bubbleDOM.style.visibility = 'hidden';
})

window.addEventListener('mouseup', async function (e) {
	if (canTranslate === false) return;
	let selection = (window.getSelection()).toString();
	if (selection.length < 1 || selection === '\n' || selection === '\r' || selection === ' ')
		bubbleDOM.style.visibility = 'hidden';
	else {
		let rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
		coords = [e.x, e.y, rect.width, rect.height];
		// doesn't let you append last translation
		[reqFinished, translatedBlocks] = [[], []];
		/* request has text amount limit (approx 400-500 chars) so the workaround is to
		 split text to sentences then send it by separate requests */
		if (selection.length > 220) {
			let v = selection.match(/.*?\D[.!?]+|.*/gs)// split every sentence with . or ! or ? also it won't split dot after number
			if (v[v.length - 1] === '') { // removes empty string
				v.pop()
			}
			// fill new boolean array to keep track of successful requests 
			reqFinished = new Array(v.length).fill(false);
			loop1: for (let i = 0; i < v.length; i++) {
				apiRequest(v[i].toString());
				// wait until response is received
				while (reqFinished === [] || reqFinished[i] === false) {
					// console.log('Initializing ', requestsFinished);
					if (window.getSelection().isCollapsed.toString() === 'true') {
						// if user close selection then set value to []
						[reqFinished, translatedBlocks, detectedBlocks] = [[], [], []];
						isLastSent = true;
						break loop1;
					}
					await new Promise(r => setTimeout(r, 500)); // wait half a second
				}

			}
		} else {
			apiRequest(selection)
		}
	}
});


function cssProperties(elem, attrs) {
	for (let key in attrs) {
		elem.style.setProperty(key, attrs[key]);
	}
}

function copyToClipboard(text) {
	// https://stackoverflow.com/questions/3436102/copy-to-clipboard-in-chrome-extension
	let copyFrom = document.createElement("textarea");
	copyFrom.textContent = text;
	document.body.appendChild(copyFrom);
	copyFrom.select();
	document.execCommand('copy');
	copyFrom.blur();
	document.body.removeChild(copyFrom);
}