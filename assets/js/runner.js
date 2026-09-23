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

// 輔助函式：防 HTML 標籤注入與渲染異常
function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function runCode() {
    const consoleBox = document.getElementById('console-output') || 
                       document.getElementById('console') || 
                       document.getElementById('output');
    
    if (!consoleBox) {
        alert("找不到終端機輸出框！");
        return;
    }
    
    consoleBox.innerHTML = '<span style="color: #60a5fa;">[系統] 正在將程式碼與輸入資料編碼並傳送至 Judge0 雲端 GCC 編譯器...</span><br>';

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

        // 1. 強制讀取當前 Stdin 輸入框 DOM，若沒有則讀取全域變數
        const stdinInputElem = document.getElementById('stdin-input');
        const rawStdin = stdinInputElem ? stdinInputElem.value : (window.currentStdin || "");

        // 2. 💡【關鍵修復】因為 API 帶了 base64_encoded=true，source_code 與 stdin 都必須轉為 Base64！
        const encodedCode = btoa(unescape(encodeURIComponent(code)));
        const encodedStdin = btoa(unescape(encodeURIComponent(rawStdin)));

        const cacheBuster = Date.now();
        const url = `https://ce.judge0.com/submissions?wait=true&base64_encoded=true&_cb=${cacheBuster}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({
                source_code: encodedCode,
                language_id: 54, // C++ (GCC 9.2.0)
                stdin: encodedStdin // 👈 這裡同步給予 Base64 編碼！
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API 錯誤 (HTTP ${response.status}): ${errorText}`);
        }

        const result = await response.json();

        // 3. 安全 Base64 解碼函式（完整支援 UTF-8 中文字串）
        const decodeBase64 = (base64Str) => {
            if (!base64Str) return "";
            try {
                return decodeURIComponent(escape(atob(base64Str)));
            } catch (e) {
                return atob(base64Str); // 備用解碼
            }
        };

        const compileOutput = decodeBase64(result.compile_output);
        const stdout = decodeBase64(result.stdout);
        const stderr = decodeBase64(result.stderr);

        // 檢查編譯失敗 (status.id === 6 代表 Compilation Error)
        if (result.status && result.status.id === 6) {
            consoleBox.innerHTML += `<br><span style="color: #f87171; font-weight: bold;">❌ [編譯失敗 Compile Error]</span><br>`;
            consoleBox.innerHTML += `<pre style="color: #fca5a5; background: #2d1618; padding: 10px; border-radius: 6px; white-space: pre-wrap; margin-top: 5px;">${escapeHtml(compileOutput || '語法錯誤')}</pre>`;
            return;
        }

        // 檢查執行期錯誤 (status.id >= 7)
        if (result.status && result.status.id >= 7) {
            consoleBox.innerHTML += `<br><span style="color: #f87171; font-weight: bold;">❌ [執行期錯誤: ${result.status.description}]</span><br>`;
            if (stderr) {
                consoleBox.innerHTML += `<pre style="color: #fca5a5; background: #2d1618; padding: 10px; white-space: pre-wrap; margin-top: 5px;">${escapeHtml(stderr)}</pre>`;
            }
            return;
        }

        // 成功執行
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
