const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");

let chatHistory = [
  { role: "assistant", content: "سلام پرهام 😎\nالان UI شبیه ChatGPT شد. بگو چی بسازیم؟" }
];
let isProcessing = false;

// Auto-resize
userInput.addEventListener("input", () => {
  userInput.style.height = "auto";
  userInput.style.height = userInput.scrollHeight + "px";
});

// Enter to send
userInput.addEventListener("keydown", (e) => {
  if(e.key === "Enter" && !e.shiftKey){
    e.preventDefault();
    sendMessage();
  }
});

sendButton.addEventListener("click", sendMessage);

async function sendMessage(){
  const message = userInput.value.trim();
  if(!message || isProcessing) return;

  isProcessing = true;
  userInput.disabled = true;
  sendButton.disabled = true;

  addMessage("user", message);
  userInput.value = "";
  userInput.style.height = "auto";
  chatHistory.push({role:"user", content:message});

  try {
    const assistantEl = document.createElement("div");
    assistantEl.className = "message assistant";
    const contentEl = document.createElement("div");
    contentEl.className = "message-content";
    assistantEl.appendChild(contentEl);
    chatMessages.appendChild(assistantEl);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    const response = await fetch("/api/chat", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body: JSON.stringify({messages:chatHistory})
    });

    if(!response.ok || !response.body) throw new Error("API Error");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "", text="";

    while(true){
      const {done, value} = await reader.read();
      if(done) break;

      buffer += decoder.decode(value, {stream:true});
      const parts = buffer.split("\n\n");
      buffer = parts.pop();

      for(const part of parts){
        const lines = part.split("\n");
        for(const line of lines){
          if(!line.startsWith("data:")) continue;
          const data = line.replace("data:","").trim();
          if(data === "[DONE]") break;

          try{
            const json = JSON.parse(data);
            let content = json.response || json.choices?.[0]?.delta?.content || "";
            if(content){
              text += content;
              contentEl.textContent = text;
              chatMessages.scrollTop = chatMessages.scrollHeight;
            }
          }catch(e){console.error(e)}
        }
      }
    }

    if(text) chatHistory.push({role:"assistant", content:text});

  }catch(e){
    console.error(e);
    addMessage("assistant","⚠️ خطا در دریافت پاسخ از AI.");
  }finally{
    isProcessing=false;
    userInput.disabled=false;
    sendButton.disabled=false;
    userInput.focus();
  }
}

function addMessage(role, content){
  const messageEl = document.createElement("div");
  messageEl.className = `message ${role}`;
  const contentEl = document.createElement("div");
  contentEl.className = "message-content";
  contentEl.textContent = content;
  messageEl.appendChild(contentEl);
  chatMessages.appendChild(messageEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
