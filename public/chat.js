const chatMessages = document.getElementById("chat-messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");

let chatHistory = [
  {role:"assistant", content:"سلام! چطور می‌تونم کمکتون کنم؟"}
];

let isProcessing=false;

userInput.addEventListener("input", () => {
  userInput.style.height="auto";
  userInput.style.height = userInput.scrollHeight + "px";
});

userInput.addEventListener("keydown", e => {
  if(e.key==="Enter" && !e.shiftKey){
    e.preventDefault();
    sendMessage();
  }
});

sendButton.addEventListener("click", sendMessage);

async function sendMessage(){
  const message = userInput.value.trim();
  if(!message || isProcessing) return;

  isProcessing=true;
  userInput.disabled=true;
  sendButton.disabled=true;

  addMessage("user", message);
  chatHistory.push({role:"user", content:message});
  userInput.value="";
  userInput.style.height="auto";

  try{
    const response = await fetch("/api/chat", {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({messages:chatHistory})
    });

    if(!response.ok) throw new Error("خطا در دریافت پاسخ AI");
    const data = await response.json();
    const aiText = data.response || "⚠️ پاسخ AI موجود نیست";

    addMessage("assistant", aiText);
    chatHistory.push({role:"assistant", content:aiText});
  }
  catch(err){
    console.error(err);
    addMessage("assistant","⚠️ خطا در دریافت پاسخ AI");
  }
  finally{
    isProcessing=false;
    userInput.disabled=false;
    sendButton.disabled=false;
    userInput.focus();
  }
}

function addMessage(role, content){
  const msgEl = document.createElement("div");
  msgEl.className=`message ${role}`;

  const contentEl=document.createElement("div");
  contentEl.className="message-content";

  renderMarkdown(contentEl, content);

  msgEl.appendChild(contentEl);
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop=chatMessages.scrollHeight;
}

function renderMarkdown(el,text){
  if(typeof marked!=="undefined"){
    el.innerHTML = marked.parse(text);
  } else {
    el.textContent=text;
  }
  addCopyButtons(el);
  chatMessages.scrollTop=chatMessages.scrollHeight;
}

function addCopyButtons(container){
  const blocks=container.querySelectorAll("pre");
  blocks.forEach(block=>{
    if(block.querySelector(".copy-btn")) return;

    const btn=document.createElement("button");
    btn.className="copy-btn";
    btn.innerText="Copy";
    btn.onclick=()=>{
      const code = block.querySelector("code").innerText;
      navigator.clipboard.writeText(code);
      btn.innerText="Copied!";
      setTimeout(()=>btn.innerText="Copy",1500);
    };
    block.appendChild(btn);
  });
}
