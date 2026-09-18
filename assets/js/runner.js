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
    const code = editor.getValue ? editor.getValue() : document.getElementById('codeEditor').value;
    const consoleBox = document.getElementById('console');
    
    consoleBox.innerHTML = '<span style="color: #60a5fa;">[系統] 正在將程式碼傳送至 GCC 編譯器...</span><br>';

    try {
        // 發送請求給 Judge0 API
        const response = await fetch('https://ce.judge0.com/submissions?wait=true', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_code: code,
                language_id: 54, // C++ (GCC 9.2.0)
                stdin: window.currentStdin || ""
            })
        });

        const result = await response.json();

        // 1. 檢查是否編譯失敗 (Compilation Error, status.id === 6)
        if (result.status && result.status.id === 6) {
            consoleBox.innerHTML += `<br><span style="color: #f87171; font-weight: bold;">❌ [編譯失敗 Compile Error]</span><br>`;
            consoleBox.innerHTML += `<pre style="color: #fca5a5; background: #2d1618; padding: 10px; border-radius: 6px;">${escapeHtml(result.compile_output || '語法錯誤')}</pre>`;
            return;
        }

        // 2. 檢查是否執行階段錯誤 (Runtime Error)
        if (result.status && result.status.id >= 7) {
            consoleBox.innerHTML += `<br><span style="color: #f87171; font-weight: bold;">❌ [執行期錯誤 Runtime Error: ${result.status.description}]</span><br>`;
            if (result.stderr) {
                consoleBox.innerHTML += `<pre style="color: #fca5a5; background: #2d1618; padding: 10px; border-radius: 6px;">${escapeHtml(result.stderr)}</pre>`;
            }
            return;
        }

        // 3. 正常執行成功
        consoleBox.innerHTML += `<br><span style="color: #4ade80; font-weight: bold;">✅ [程式執行成功]</span><br>`;
        if (result.stdout) {
            consoleBox.innerHTML += `<pre style="color: #e2e8f0;">${escapeHtml(result.stdout)}</pre>`;
        } else {
            consoleBox.innerHTML += `<span style="color: #94a3b8;">(程式無任何輸出)</span><br>`;
        }

    } catch (err) {
        consoleBox.innerHTML += `<br><span style="color: #f87171;">❌ [網路或 API 呼叫失敗]: ${err.message}</span>`;
    }
}

// 轉義 HTML 避免預覽區被特殊字串破壞
function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
