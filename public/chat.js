/**
 * LLM Chat App Frontend – ChatGPT Style
 */

const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");
const typingIndicator = document.getElementById("typing-indicator");

let chatHistory = [
  { role: "assistant", content: "سلام پرهام 😎\nالان UI شبیه ChatGPT شد. بگو چی بسازیم؟" }
];
let isProcessing = false;

// Auto resize textarea
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = userInput.scrollHeight + "px";
});

// Enter to send
userInput.addEventListener("keydown", e => {
  if(e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    sendMessage();
  }
});

sendButton.addEventListener("click", sendMessage);

// Send message function
async function sendMessage() {
  const message = userInput.value.trim();
  if(!message || isProcessing) return;

  isProcessing = true;
  userInput.disabled = true;
  sendButton.disabled = true;

  addMessage("user", message);
  userInput.value = "";
  userInput.style.height = "auto";
  chatHistory.push({ role: "user", content: message });

  try {
    const assistantEl = document.createElement("div");
    assistantEl.className = "message assistant";
    const contentEl = document.createElement("div");
    contentEl.className = "message-content";
    assistantEl.appendChild(contentEl);
    chatMessages.appendChild(assistantEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    typingIndicator?.classList.add("visible");

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: chatHistory })
    });

    if(!response.ok || !response.body) throw new Error("API error");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = "", buffer = "";
    let doneReading = false;

    while(!doneReading){
      const { done, value } = await reader.read();
      if(done) break;
      buffer += decoder.decode(value, { stream:true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for(const part of parts){
        const lines = part.split("\n");
        for(const line of lines){
          if(!line.startsWith("data:")) continue;
          const data = line.replace("data:", "").trim();
          if(data === "[DONE]") { doneReading = true; break; }

          try {
            const json = JSON.parse(data);
            let content = "";
            if(json.response) content = json.response;
            else if(json.choices?.[0]?.delta?.content) content = json.choices[0].delta.content;

            if(content){
              responseText += content;
              renderMarkdown(contentEl, responseText);
            }
          } catch(e){
            console.error("Parse error:", e, data);
          }
        }
      }
    }

    if(responseText) chatHistory.push({ role: "assistant", content: responseText });

  } catch(err){
    console.error(err);
    addMessage("assistant", "⚠️ متاسفم، مشکلی در پردازش پاسخ رخ داد.");
  } finally {
    isProcessing = false;
    userInput.disabled = false;
    sendButton.disabled = false;
    userInput.focus();
    typingIndicator?.classList.remove("visible");
  }
}

// Add message (user or assistant)
function addMessage(role, content){
  const msgEl = document.createElement("div");
  msgEl.className = `message ${role}`;
  const contentEl = document.createElement("div");
  contentEl.className = "message-content";
  renderMarkdown(contentEl, content);
  msgEl.appendChild(contentEl);
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Markdown render with code block support
function renderMarkdown(element, text){
  // Convert ```code``` to <pre><code>
  const codeRegex = /```([\s\S]*?)```/g;
  let html = text.replace(codeRegex, (match, p1)=>{
    return `<pre><code>${p1.trim()}</code></pre>`;
  });

  // Split by paragraphs
  html = html.split("\n\n").map(p=>{
    if(p.includes("<pre>")) return p;
    return `<p>${p}</p>`;
  }).join("");

  element.innerHTML = html;
  addCopyButtons(element);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add copy button to <pre><code>
function addCopyButtons(container){
  const blocks = container.querySelectorAll("pre");
  blocks.forEach(block=>{
    if(block.querySelector(".copy-btn")) return;

    block.style.position="relative";
    const button = document.createElement("button");
    button.className="copy-btn";
    button.innerText="Copy";
    button.onclick = ()=>{
      const code = block.querySelector("code")?.innerText || "";
      navigator.clipboard.writeText(code);
      button.innerText="Copied!";
      setTimeout(()=>button.innerText="Copy",1500);
    };

    button.style.position="absolute";
    button.style.top="6px";
    button.style.right="6px";
    button.style.padding="3px 7px";
    button.style.fontSize="12px";
    button.style.borderRadius="6px";
    button.style.border="none";
    button.style.cursor="pointer";
    button.style.background="#10a37f";
    button.style.color="#fff";

    block.appendChild(button);
  });
}
