/**
 * chat.js — upgraded
 *
 * - Stream-safe rendering
 * - Markdown rendering (marked)
 * - Copy button on code blocks (top-right)
 * - Basic HTML sanitization (remove <script>, on* handlers, javascript: urls)
 */

// DOM elements
const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

// Chat state
let chatHistory = [
	{
		role: "assistant",
		content:
			"Hello! I'm an LLM chat app powered by Cloudflare Workers AI. How can I help you today?",
	},
];
let isProcessing = false;

// --- marked loader (CDN) ---
let _markedLoader = null;
function loadMarked() {
	if (typeof marked !== "undefined") return Promise.resolve();
	if (_markedLoader) return _markedLoader;
	_markedLoader = new Promise((resolve, reject) => {
		const s = document.createElement("script");
		s.src = "https://cdn.jsdelivr.net/npm/marked/marked.min.js";
		s.onload = () => resolve();
		s.onerror = () => reject(new Error("Failed to load marked.js"));
		document.head.appendChild(s);
	});
	return _markedLoader;
}

// --- basic sanitizer (removes scripts, on* attrs, javascript: src/href) ---
function sanitizeHTML(html) {
	// parse into template to get nodes
	const tpl = document.createElement("template");
	tpl.innerHTML = html;

	function walk(node) {
		// remove dangerous elements
		if (node.nodeType === 1) {
			const tag = node.tagName.toLowerCase();
			const forbidden = ["script", "style", "iframe", "object", "embed", "link", "meta"];
			if (forbidden.includes(tag)) {
				node.remove();
				return; // removed, no need to traverse children
			}

			// remove event handlers and dangerous attrs
			for (const attr of Array.from(node.attributes)) {
				const name = attr.name.toLowerCase();
				const val = attr.value || "";
				if (name.startsWith("on")) {
					node.removeAttribute(attr.name);
				} else if ((name === "href" || name === "src") && /^\s*javascript:/i.test(val)) {
					node.removeAttribute(attr.name);
				} else if (name === "style" && /expression\s*\(|url\(/i.test(val)) {
					// crude check for dangerous CSS
					node.removeAttribute(attr.name);
				}
			}
		}

		// copy children array because we might modify children while iterating
		for (const child of Array.from(node.childNodes)) {
			walk(child);
		}
	}

	walk(tpl.content);
	return tpl.innerHTML;
}

// --- render markdown into element safely (falls back to plain text until marked loads) ---
function renderMarkdown(element, text) {
	// If marked exists, parse & sanitize immediately
	if (typeof marked !== "undefined") {
		try {
			const raw = marked.parse(text);
			element.innerHTML = sanitizeHTML(raw);
		} catch (e) {
			// fallback to plaintext
			element.textContent = text;
		}
		addCopyButtons(element);
		chatMessages.scrollTop = chatMessages.scrollHeight;
		return;
	}

	// fallback: show plain text and load marked in background (then re-render)
	element.textContent = text;
	chatMessages.scrollTop = chatMessages.scrollHeight;

	loadMarked()
		.then(() => {
			// re-render with marked
			try {
				const raw = marked.parse(text);
				element.innerHTML = sanitizeHTML(raw);
			} catch (e) {
				element.textContent = text;
			}
			addCopyButtons(element);
			chatMessages.scrollTop = chatMessages.scrollHeight;
		})
		.catch(() => {
			// couldn't load marked — leave plain text
		});
}

// --- add Copy buttons to code blocks (top-right) ---
function addCopyButtons(container) {
	const blocks = container.querySelectorAll("pre");

	blocks.forEach((block) => {
		// avoid duplicating the button
		if (block.querySelector(".copy-btn")) return;

		// ensure position relative for absolute button
		block.style.position = block.style.position || "relative";

		// create wrapper for header (language label)
		const header = document.createElement("div");
		header.className = "code-header";
		header.style.position = "absolute";
		header.style.top = "6px";
		header.style.right = "6px";
		header.style.display = "flex";
		header.style.gap = "8px";
		header.style.alignItems = "center";
		header.style.zIndex = 5; // above code

		// copy button
		const button = document.createElement("button");
		button.innerText = "Copy";
		button.className = "copy-btn";
		button.style.padding = "6px 8px";
		button.style.fontSize = "12px";
		button.style.borderRadius = "8px";
		button.style.border = "none";
		button.style.cursor = "pointer";
		button.style.background = "#10a37f";
		button.style.color = "#fff";
		button.style.boxShadow = "0 1px 0 rgba(0,0,0,0.15)";

		button.addEventListener("click", async (e) => {
			e.stopPropagation();
			const codeEl = block.querySelector("code");
			if (!codeEl) return;
			const text = codeEl.innerText;
			try {
				await navigator.clipboard.writeText(text);
				const prev = button.innerText;
				button.innerText = "Copied!";
				setTimeout(() => (button.innerText = prev), 1500);
			} catch (err) {
				// fallback: select + execCommand (older browsers)
				const range = document.createRange();
				range.selectNodeContents(codeEl);
				const sel = window.getSelection();
				sel.removeAllRanges();
				sel.addRange(range);
				try {
					document.execCommand("copy");
					const prev = button.innerText;
					button.innerText = "Copied!";
					setTimeout(() => (button.innerText = prev), 1500);
				} catch (e) {
					button.innerText = "Copy";
				}
				sel.removeAllRanges();
			}
		});

		// optional: display language if present in <code class="language-xxx">
		const codeTag = block.querySelector("code");
		if (codeTag) {
			const className = codeTag.className || "";
			const m = className.match(/language-([a-z0-9]+)/i);
			if (m) {
				const langLabel = document.createElement("span");
				langLabel.innerText = m[1].toUpperCase();
				langLabel.style.padding = "4px 8px";
				langLabel.style.fontSize = "11px";
				langLabel.style.borderRadius = "6px";
				langLabel.style.background = "rgba(0,0,0,0.25)";
				langLabel.style.color = "#fff";
				header.appendChild(langLabel);
			}
		}

		header.appendChild(button);
		block.appendChild(header);
	});
}

// --- Auto-resize textarea as user types ---
userInput.addEventListener("input", function () {
	this.style.height = "auto";
	this.style.height = this.scrollHeight + "px";
});

// Send message on Enter (without Shift)
userInput.addEventListener("keydown", function (e) {
	if (e.key === "Enter" && !e.shiftKey) {
		e.preventDefault();
		sendMessage();
	}
});

// Send button click handler
sendButton.addEventListener("click", sendMessage);

/**
 * Sends a message to the chat API and processes the response (streaming)
 */
async function sendMessage() {
	const message = userInput.value.trim();

	// Don't send empty messages
	if (message === "" || isProcessing) return;

	// Disable input while processing
	isProcessing = true;
	userInput.disabled = true;
	sendButton.disabled = true;

	// Add user message to chat
	addMessageToChat("user", message);

	// Clear input
	userInput.value = "";
	userInput.style.height = "auto";

	// Show typing indicator
	if (typingIndicator) typingIndicator.classList.add("visible");

	// Add message to history
	chatHistory.push({ role: "user", content: message });

	try {
		// Create new assistant response element
		const assistantMessageEl = document.createElement("div");
		assistantMessageEl.className = "message assistant-message";

		const contentEl = document.createElement("div");
		contentEl.className = "message-content";
		assistantMessageEl.appendChild(contentEl);

		chatMessages.appendChild(assistantMessageEl);

		// Scroll to bottom
		chatMessages.scrollTop = chatMessages.scrollHeight;

		// Send request to API
		const response = await fetch("/api/chat", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				messages: chatHistory,
			}),
		});

		// Handle errors
		if (!response.ok) {
			throw new Error("Failed to get response");
		}
		if (!response.body) {
			throw new Error("Response body is null");
		}

		// Process streaming response
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let responseText = "";
		let buffer = "";
		const flushAssistantText = () => {
			// render markdown (safe) as it streams
			renderMarkdown(contentEl, responseText);
			chatMessages.scrollTop = chatMessages.scrollHeight;
		};

		let sawDone = false;
		while (true) {
			const { done, value } = await reader.read();

			if (done) {
				// Process any remaining complete events in buffer
				const parsed = consumeSseEvents(buffer + "\n\n");
				for (const data of parsed.events) {
					if (data === "[DONE]") {
						break;
					}
					try {
						const jsonData = JSON.parse(data);
						// Handle both Workers AI format (response) and OpenAI format (choices[0].delta.content)
						let content = "";
						if (typeof jsonData.response === "string" && jsonData.response.length > 0) {
							content = jsonData.response;
						} else if (jsonData.choices?.[0]?.delta?.content) {
							content = jsonData.choices[0].delta.content;
						}
						if (content) {
							responseText += content;
							flushAssistantText();
						}
					} catch (e) {
						console.error("Error parsing SSE data as JSON:", e, data);
					}
				}
				break;
			}

			// Decode chunk
			buffer += decoder.decode(value, { stream: true });
			const parsed = consumeSseEvents(buffer);
			buffer = parsed.buffer;
			for (const data of parsed.events) {
				if (data === "[DONE]") {
					sawDone = true;
					buffer = "";
					break;
				}
				try {
					const jsonData = JSON.parse(data);
					// Handle both Workers AI format (response) and OpenAI format (choices[0].delta.content)
					let content = "";
					if (typeof jsonData.response === "string" && jsonData.response.length > 0) {
						content = jsonData.response;
					} else if (jsonData.choices?.[0]?.delta?.content) {
						content = jsonData.choices[0].delta.content;
					}
					if (content) {
						responseText += content;
						flushAssistantText();
					}
				} catch (e) {
					console.error("Error parsing SSE data as JSON:", e, data);
				}
			}
			if (sawDone) {
				break;
			}
		}

		// Add completed response to chat history
		if (responseText.length > 0) {
			chatHistory.push({ role: "assistant", content: responseText });
		}
	} catch (error) {
		console.error("Error:", error);
		addMessageToChat("assistant", "Sorry, there was an error processing your request.");
	} finally {
		// Hide typing indicator
		if (typingIndicator) typingIndicator.classList.remove("visible");

		// Re-enable input
		isProcessing = false;
		userInput.disabled = false;
		sendButton.disabled = false;
		userInput.focus();
	}
}

/**
 * Helper function to add message to chat
 */
function addMessageToChat(role, content) {
	const messageEl = document.createElement("div");
	messageEl.className = `message ${role}-message`;

	const contentEl = document.createElement("div");
	contentEl.className = "message-content";

	renderMarkdown(contentEl, content);

	messageEl.appendChild(contentEl);
	chatMessages.appendChild(messageEl);

	// Scroll to bottom
	chatMessages.scrollTop = chatMessages.scrollHeight;
}

function consumeSseEvents(buffer) {
	let normalized = buffer.replace(/\r/g, "");
	const events = [];
	let eventEndIndex;
	while ((eventEndIndex = normalized.indexOf("\n\n")) !== -1) {
		const rawEvent = normalized.slice(0, eventEndIndex);
		normalized = normalized.slice(eventEndIndex + 2);

		const lines = rawEvent.split("\n");
		const dataLines = [];
		for (const line of lines) {
			if (line.startsWith("data:")) {
				dataLines.push(line.slice("data:".length).trimStart());
			}
		}
		if (dataLines.length === 0) continue;
		events.push(dataLines.join("\n"));
	}
	return { events, buffer: normalized };
}
