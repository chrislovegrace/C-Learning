// assets/js/runner.js - 共享的 Judge0 API 執行引擎
let resolveCin = null;

// 更新終端機顯示
function appendConsole(html) {
    const consoleOutput = document.getElementById('console-output');
    if (consoleOutput) {
        consoleOutput.innerHTML += `<div>${html}</div>`;
        consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
}

// 清空終端機
function clearConsole() {
    const consoleOutput = document.getElementById('console-output');
    if (consoleOutput) consoleOutput.innerHTML = '';
}

// 轉義 HTML 避免 XSS
function escapeHtml(unsafe) {
    if (unsafe == null) return '';
    return unsafe.toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// 請求 cin 輸入 UI
function requestStdinUI() {
    return new Promise((resolve) => {
        const container = document.getElementById('cin-prompt-container');
        const input = document.getElementById('cin-input');
        
        resolveCin = resolve;
        if (container) container.classList.remove('hidden');
        if (input) {
            input.value = '';
            input.placeholder = "請輸入執行所需的資料...";
            input.focus();
        }
    });
}

function handleCinSubmit(e) {
    if (e.key === 'Enter') submitCinValue();
}

function submitCinValue() {
    const input = document.getElementById('cin-input');
    const container = document.getElementById('cin-prompt-container');
    if (container) container.classList.add('hidden');
    if (resolveCin && input) {
        resolveCin(input.value);
        resolveCin = null;
    }
}

async function runCode() {
    // 自動尋找頁面上的終端機容器 (支援 console, output, terminal)
    const consoleBox = document.getElementById('console') || 
                       document.getElementById('output') || 
                       document.getElementById('terminal');
    
    if (!consoleBox) {
        alert("找不到終端機輸出框！請在 HTML 中確認是否有 id='console' 的元素。");
        return;
    }
    
    consoleBox.innerHTML = '<span style="color: #60a5fa;">[系統] 正在準備發送程式碼...</span><br>';

    try {
        let code = "";
        const textarea = document.getElementById('codeEditor') || document.getElementById('code');
        
        if (typeof editor !== 'undefined' && typeof editor.getValue === 'function') {
            code = editor.getValue();
        } else if (textarea) {
            code = textarea.value;
        } else {
            throw new Error("找不到程式碼編輯器元件！");
        }

        // 破壞快取
        code += `\n// _no_cache_${Date.now()} \n`;

        consoleBox.innerHTML += '<span style="color: #60a5fa;">[系統] 正在傳送至 Judge0 雲端 GCC 編譯器...</span><br>';

        const response = await fetch('https://ce.judge0.com/submissions?wait=true&base64_encoded=false', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_code: code,
                language_id: 54,
                stdin: window.currentStdin || ""
            })
        });

        if (!response.ok) throw new Error(`API 伺服器錯誤: ${response.status}`);

        const result = await response.json();

        if (result.status && result.status.id === 6) {
            consoleBox.innerHTML += `<br><span style="color: #f87171; font-weight: bold;">❌ [編譯失敗 Compile Error]</span><br>`;
            consoleBox.innerHTML += `<pre style="color: #fca5a5; background: #2d1618; padding: 10px; border-radius: 6px; white-space: pre-wrap;">${escapeHtml(result.compile_output || '語法錯誤')}</pre>`;
            return;
        }

        if (result.status && result.status.id >= 7) {
            consoleBox.innerHTML += `<br><span style="color: #f87171; font-weight: bold;">❌ [執行期錯誤: ${result.status.description}]</span><br>`;
            if (result.stderr) {
                consoleBox.innerHTML += `<pre style="color: #fca5a5; background: #2d1618; padding: 10px; white-space: pre-wrap;">${escapeHtml(result.stderr)}</pre>`;
            }
            return;
        }

        consoleBox.innerHTML += `<br><span style="color: #4ade80; font-weight: bold;">[系統] 程式執行成功 (Exit Code 0)</span><br><br>`;
        if (result.stdout) {
            consoleBox.innerHTML += `<pre style="color: #fbbf24; font-size: 15px; font-weight: bold; white-space: pre-wrap;">${escapeHtml(result.stdout)}</pre>`;
        } else {
            consoleBox.innerHTML += `<span style="color: #94a3b8;">(程式無任何輸出)</span><br>`;
        }

    } catch (err) {
        consoleBox.innerHTML += `<br><span style="color: #f87171; font-weight: bold;">❌ [執行例外錯誤]:</span><br>`;
        consoleBox.innerHTML += `<pre style="color: #fca5a5;">${escapeHtml(err.message)}</pre>`;
    }
}

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

// HTML 字元跳脫函式
function escapeHtml(text) {
    if (!text) return "";
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
