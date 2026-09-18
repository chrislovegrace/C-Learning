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

// 核心執行函式：對接 Judge0 雲端沙盒
async function runCode() {
    clearConsole();
    const codeEditor = document.getElementById('code-editor');
    if (!codeEditor) return false;
    
    const code = codeEditor.value;
    let stdinData = "";

    if (code.includes("cin >>") || code.includes("getline")) {
        appendConsole('<span class="text-amber-400 mb-2 block">💡 [系統] 程式碼包含 cin 輸入，請在輸入框提供資料並送出。</span>');
        stdinData = await requestStdinUI();
        if (stdinData === null) {
            appendConsole('<span class="text-amber-400 mt-2 block">⚠️ [系統] 執行已取消。</span>');
            return false;
        }
        stdinData += "\n";
    }

    appendConsole('<span class="text-blue-400 mb-2 block">[系統] 正在將程式碼傳送至 Judge0 雲端沙盒...</span>');

    try {
        const response = await fetch("https://ce.judge0.com/submissions?wait=true", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                source_code: code,
                language_id: 54, // C++ (GCC 9.2.0)
                stdin: stdinData
            })
        });

        const result = await response.json();

        if (result.compile_output) {
            appendConsole('<span class="text-red-400 font-bold block mt-2">❌ [GCC 編譯失敗] 語法錯誤：</span>');
            result.compile_output.split('\n').forEach(line => {
                if (line.trim()) appendConsole(`<span class="text-red-300 ml-2 block">${escapeHtml(line)}</span>`);
            });
            return false;
        }

        if (result.stderr) {
            appendConsole(`<span class="text-red-400 font-bold block mt-2">❌ [Runtime Error]</span>`);
            appendConsole(`<span class="text-red-300 ml-2 block">${escapeHtml(result.stderr)}</span>`);
            return false;
        }

        if (result.stdout !== undefined && result.stdout !== null) {
            result.stdout.split('\n').forEach(line => {
                if (line !== "") appendConsole(`<span class="text-slate-300 block">${escapeHtml(line).replace(/ /g, '&nbsp;')}</span>`);
            });
        }

        appendConsole(`<br><span class="text-emerald-400 mt-2 block">[系統] 程式執行成功 (Exit Code 0)</span>`);
        return true;

    } catch (err) {
        appendConsole('<span class="text-red-400 mb-2 block">❌ [連線失敗] 無法連接至雲端編譯 API。</span>');
        return false;
    }
}
