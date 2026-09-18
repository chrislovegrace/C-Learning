// assets/js/python-runner.js - 共享的 Judge0 API Python 執行引擎
let resolveStdin = null;

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

// 轉義 HTML 避免 XSS 攻擊
function escapeHtml(unsafe) {
    if (unsafe == null) return '';
    return unsafe.toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// 請求 input() 標準輸入 UI (相容舊版 cin 容器 ID)
function requestStdinUI() {
    return new Promise((resolve) => {
        const container = document.getElementById('stdin-prompt-container') || document.getElementById('cin-prompt-container');
        const input = document.getElementById('stdin-input') || document.getElementById('cin-input');

        resolveStdin = resolve;
        if (container) container.classList.remove('hidden');
        if (input) {
            input.value = '';
            input.placeholder = "請輸入 Python input() 所需的資料...";
            input.focus();
        }
    });
}

function handleStdinSubmit(e) {
    if (e.key === 'Enter') submitStdinValue();
}

function submitStdinValue() {
    const input = document.getElementById('stdin-input') || document.getElementById('cin-input');
    const container = document.getElementById('stdin-prompt-container') || document.getElementById('cin-prompt-container');
    if (container) container.classList.add('hidden');
    if (resolveStdin && input) {
        resolveStdin(input.value);
        resolveStdin = null;
    }
}

async function runCode() {
    const consoleBox = document.getElementById('console-output') ||
                       document.getElementById('console') ||
                       document.getElementById('output');

    if (!consoleBox) {
        alert("找不到終端機輸出框！");
        return;
    }

    consoleBox.innerHTML = '<span style="color: #60a5fa;">[系統] 正在將程式碼編碼並傳送至 Judge0 雲端 Python 直譯器...</span><br>';

    try {
        let code = "";
        const textarea = document.getElementById('code-editor') ||
                         document.getElementById('codeEditor') ||
                         document.getElementById('code');

        if (typeof editor !== 'undefined' && typeof editor.getValue === 'function') {
            code = editor.getValue();
        } else if (textarea) {
            code = textarea.value;
        } else {
            throw new Error("找不到程式碼編輯器元件！");
        }

        // 將程式碼轉為 Base64 (支援中文與特殊字元)
        const encodedCode = btoa(unescape(encodeURIComponent(code)));
        const cacheBuster = Date.now();
        const url = `https://ce.judge0.com/submissions?wait=true&base64_encoded=true&_cb=${cacheBuster}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source_code: encodedCode,
                language_id: 71, // Judge0 中的 Python (3.8.1)；若需 Python 3.11 可改為 92
                stdin: window.currentStdin || ""
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 錯誤 (HTTP ${response.status}): ${errorText}`);
        }

        const result = await response.json();

        // Base64 解碼函式
        const decodeBase64 = (base64Str) => {
            if (!base64Str) return "";
            try {
                return decodeURIComponent(escape(atob(base64Str)));
            } catch (e) {
                return atob(base64Str);
            }
        };

        const compileOutput = decodeBase64(result.compile_output);
        const stdout = decodeBase64(result.stdout);
        const stderr = decodeBase64(result.stderr);

        // 1. 檢查語法錯誤 (Compilation / Syntax Error)
        if (result.status && result.status.id === 6) {
            consoleBox.innerHTML += `<br><span style="color: #f87171; font-weight: bold;">❌ [語法錯誤 Syntax Error]</span><br>`;
            consoleBox.innerHTML += `<pre style="color: #fca5a5; background: #2d1618; padding: 10px; border-radius: 6px; white-space: pre-wrap; margin-top: 5px;">${escapeHtml(compileOutput || stderr || '語法錯誤')}</pre>`;
            return;
        }

        // 2. 檢查執行期錯誤 (Runtime Error)
        if (result.status && result.status.id >= 7) {
            consoleBox.innerHTML += `<br><span style="color: #f87171; font-weight: bold;">❌ [執行期錯誤: ${result.status.description}]</span><br>`;
            if (stderr) {
                consoleBox.innerHTML += `<pre style="color: #fca5a5; background: #2d1618; padding: 10px; border-radius: 6px; white-space: pre-wrap; margin-top: 5px;">${escapeHtml(stderr)}</pre>`;
            }
            return;
        }

        // 3. 成功執行
        consoleBox.innerHTML += `<br><span style="color: #4ade80; font-weight: bold;">[系統] 程式執行成功 (Exit Code 0)</span><br><br>`;
        if (stdout) {
            consoleBox.innerHTML += `<pre style="color: #fbbf24; font-size: 15px; font-weight: bold; white-space: pre-wrap; margin-top: 5px;">${escapeHtml(stdout)}</pre>`;
        } else {
            consoleBox.innerHTML += `<span style="color: #94a3b8;">(程式無任何輸出)</span><br>`;
        }

    } catch (err) {
        consoleBox.innerHTML += `<br><span style="color: #f87171; font-weight: bold;">❌ [例外錯誤]:</span><br>`;
        consoleBox.innerHTML += `<pre style="color: #fca5a5; margin-top: 5px;">${escapeHtml(err.message)}</pre>`;
        console.error("執行崩潰錯誤詳情：", err);
    }
}
