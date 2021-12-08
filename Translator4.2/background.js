// uses Local storage API to save settings
function clearStorage() {
	chrome.storage.local.clear(() => {
		var error = chrome.runtime.lastError;
		if (error) {
			console.error(error);
		}
	});
}
function saveToStorage(arg1) {
	window.stateObject = arg1
	if (window.stateObject === '' || window.stateObject === undefined)
		console.log('saveToStorage', 'shit its empty');
	else
		console.log('saveToStorage', window.stateObject);
	chrome.storage.local.set({ key: arg1 }, () => {
		// console.log('Set to ', arg1);
	})
}
function accessStorage() {
	chrome.storage.local.get(['key'], (result) => {
		// console.log(result.key);
		if (result.key === undefined) {
			// Assign to default value
			window.stateObject = {
				'extensionState': 'ON',
				'langFrom': 'auto',
				'langTo': 'en',
				'theme': 'light',
				'isDictionaryModeEnabled': true
			}
		}
		else {
			// console.log('Value currently is ', result.key)
			window.stateObject = result.key;
		}
	})
}
// clearStorage()
window.stateObject = {
	'extensionState': 'ON',
	'langFrom': 'auto',
	'langTo': 'en',
	'theme': 'light',
	'isDictionaryModeEnabled': true
}
window.clipboardContent = 'Default';
accessStorage()

chrome.runtime.onMessage.addListener(function (req, sender, sendResponse) {
	if (req.target === 'background') {
		// variables used: action content stateKey
		// console.log(req.action, req.stateKey, req.content);
		// console.log(window.stateObject);
		if (req.action === 'serialize data') {
			saveToStorage(req.content)
			sendContent('remember everything', window.stateObject);
		}
		else if (req.action === 'deserialize data') {
			sendContent('remember everything', window.stateObject);
		}
		else if (req.action === 'set') {
			window.stateObject[req.stateKey.toString()] = req.content;
			saveToStorage(window.stateObject);
			if (req.stateKey === 'extensionState') {
				sendContent('remember everything', window.stateObject);
			}
		}
		// else if (req.action === 'changeExtensionState') {
		// 	window.stateObject['extensionState'] = (window.stateObject['extensionState'] === "ON") ? "OFF" : "ON";
		// 	sendExtensionState();
		// }
		if (req.action === 'clipboard') {
			window.clipboardContent = req.content;
		}
	}
});

// sends extension state to all tabs so extension would have same properties on each tab
// if you change it to f.e. send only to last tab then the extensionState property will work incorrectly, same with languages

/*
function sendExtensionState() {
	chrome.tabs.query({}, function (tabs) {
		let message = { target: "content", action: 'extension state', content: window.stateObject['extensionState'] }
		for (var i = 0; i < tabs.length; ++i) {
			chrome.tabs.sendMessage(tabs[i].id, message);
		}
	})
}
function sendLanguage() {
	chrome.tabs.query({}, function (tabs) {
		let message = { target: "content", action: 'change language', content: window.stateObject }
		for (var i = 0; i < tabs.length; ++i) {
			chrome.tabs.sendMessage(tabs[i].id, message);
		}
	})
}
*/
function sendContent(a, c) {
	chrome.tabs.query({}, function (tabs) {
		let message = { target: "content", action: a, content: c }
		for (var i = 0; i < tabs.length; ++i) {
			chrome.tabs.sendMessage(tabs[i].id, message);
		}
	})
}
chrome.commands.onCommand.addListener(function (command) {
	if (command === "copy") {
		copyToClipboard(window.clipboardContent);
	}
});

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